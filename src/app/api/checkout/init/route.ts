import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { products } from "@/data/products";
import { twoC2PConfigured, createPaymentToken } from "@/lib/2c2p";
import { reserveStock, releaseStock } from "@/lib/stock-reservation";
import { isRateLimitedShared, clientIp } from "@/lib/rate-limit";
import { quoteDiscountCode } from "@/lib/shopify-discounts";
import { getUserLoyalty } from "@/lib/user-tier";
import { ATTRIBUTION_COOKIE, attributionColumns } from "@/lib/attribution";

// Free shipping nationwide, no minimum — the site's actual policy (see
// FREE_SHIPPING_THRESHOLD = 0 in lib/use-order-totals.ts, not imported
// here directly since that file is a "use client" hook module). Kept as
// its own constant rather than cross-importing, matching how the app
// already treats this as a fixed value, not a computed rate.
const SHIPPING_FEE_THB = 0;

type LineInput = { variantId?: string; quantity?: number };
type ResolvedLine = { variantId: string; quantity: number; price: number; slug: string; brand: string; category: string };

// Never trust client-submitted prices — resolve every line against the
// live catalogue (the same Shopify-synced `products` data every other
// checkout path in this app already uses), same principle as the
// subscription checkout route's productSlug/variantId resolution.
function resolveLines(lines: LineInput[]): ResolvedLine[] | null {
  const resolved: ResolvedLine[] = [];
  for (const line of lines) {
    if (!line.variantId || !line.quantity || line.quantity <= 0) return null;
    const product = products.find((p) => p.variants.some((v) => v.variantId === line.variantId));
    const variant = product?.variants.find((v) => v.variantId === line.variantId);
    if (!product || !variant) return null;
    resolved.push({
      variantId: variant.variantId,
      quantity: line.quantity,
      price: variant.price,
      slug: product.slug,
      brand: product.brand,
      category: product.category,
    });
  }
  return resolved;
}

const CHECKOUT_INIT_MAX_PER_HOUR = 15;

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!twoC2PConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบชำระเงินยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const { lines, shippingAddress, email, phone, couponCode } = body;
  if (
    !shippingAddress?.address1 ||
    !shippingAddress?.city ||
    !shippingAddress?.postalCode ||
    !shippingAddress?.countryCode
  ) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกที่อยู่จัดส่งให้ครบ" }, { status: 400 });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ ok: false, error: "ตะกร้าสินค้าว่างเปล่า" }, { status: 400 });
  }

  const resolved = resolveLines(lines);
  if (!resolved) return NextResponse.json({ ok: false, error: "มีสินค้าที่ไม่พบในระบบ" }, { status: 404 });

  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Every call past this point holds real inventory for 15 minutes, so an
  // unthrottled loop here can park the last unit of anything and keep it out
  // of other shoppers' carts without ever paying. The cap is deliberately far
  // above normal use — a real customer retrying a declined card a few times
  // must never hit it — and is keyed per account when there is one, so a
  // shared office IP doesn't lock colleagues out of checking out.
  const limitKey = uid ? `checkout-init:user:${uid}` : `checkout-init:ip:${clientIp(req)}`;
  if (await isRateLimitedShared(limitKey, CHECKOUT_INIT_MAX_PER_HOUR, 60 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "เริ่มการชำระเงินบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ" },
      { status: 429 }
    );
  }

  const cartToken = crypto.randomUUID();

  const reservation = await reserveStock(
    cartToken,
    resolved.map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
  );
  if (reservation.ok === false) {
    return NextResponse.json(
      { ok: false, error: "สินค้าบางชิ้นในตะกร้ามีไม่พอ กรุณาปรับจำนวน", shortVariantIds: reservation.shortVariantIds },
      { status: 409 }
    );
  }

  const subtotal = resolved.reduce((sum, l) => sum + l.price * l.quantity, 0);

  // Ask Shopify what the code is worth, against these exact lines, at this
  // exact moment — never trust a discount the client claims, and never work
  // it out here either. The customer was shown a figure quoted the same way
  // moments ago; asking again is what makes "shown" and "charged" the same
  // number even if the cart or the discount changed in between. A code that
  // no longer applies is quietly worth nothing rather than failing checkout.
  let appliedCode: string | null = null;
  let discount = 0;
  if (typeof couponCode === "string" && couponCode) {
    const quote = await quoteDiscountCode({
      code: couponCode,
      lines: resolved.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    }).catch((err) => {
      console.error("[checkout/init] discount quote failed", err);
      return { ok: false as const, reason: "quote failed" };
    });
    if (quote.ok) {
      appliedCode = quote.code;
      discount = Math.min(quote.discount, subtotal);
    }
  }

  // The lines keep their real prices and the discount rides alongside them,
  // so the Shopify order can carry the code itself rather than a set of
  // quietly reduced prices no report can explain.
  const amount = subtotal - discount + SHIPPING_FEE_THB;
  const invoiceNo = `CHKT${Date.now().toString(36).toUpperCase()}`.slice(0, 30);

  const [transaction] = await supabaseRest<{ id: string }[]>("payment_transactions", {
    method: "POST",
    body: JSON.stringify({
      cart_token: cartToken,
      user_id: uid ?? null,
      amount,
      invoice_no: invoiceNo,
      status: "pending",
      contact_email: email ?? null,
      contact_phone: phone ?? null,
      shipping_address: shippingAddress,
      line_items: resolved.map((l) => ({ variantId: l.variantId, quantity: l.quantity, price: l.price })),
      discount_code: appliedCode,
      discount_amount: discount,
      ...attributionColumns(req.cookies.get(ATTRIBUTION_COOKIE)?.value),
    }),
  });

  const origin = req.nextUrl.origin;
  try {
    const result = await createPaymentToken({
      invoiceNo,
      description: `คำสั่งซื้อ Smoothlife.com (${resolved.length} รายการ)`.slice(0, 250),
      amount,
      // Same as the flash-sale route: the payment account decides which
      // methods exist, not this file.
      // Cards and PromptPay QR only. Left open, 2C2P offers twenty-nine
      // methods — every wallet, kiosk and direct-debit rail it carries — and a
      // payment page that asks a shopper to choose from twenty-nine things is
      // a payment page they leave. These two cover what this shop's customers
      // actually use.
      //
      // The catch to know about: PromptPay QR stops at ฿50,000, so on anything
      // larger this list leaves cards as the only way through.
      paymentChannel: ["CC", "PPQR"],
      frontendReturnUrl: `${origin}/api/payments/return?cartToken=${cartToken}`,
      backendReturnUrl: `${origin}/api/webhooks/2c2p-checkout`,
      customer: { email: email ?? undefined, mobileNo: phone ?? undefined },
      shippingAddress: {
        address1: shippingAddress.address1,
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode,
        countryCode: shippingAddress.countryCode,
        state: shippingAddress.state,
      },
    });
    return NextResponse.json({ ok: true, webPaymentUrl: result.webPaymentUrl, cartToken });
  } catch (err) {
    console.error("[checkout/init] 2C2P paymentToken failed", err);
    await releaseStock(cartToken);
    await supabaseRest(`payment_transactions?id=eq.${transaction.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "failed" }),
    });
    return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { products } from "@/data/products";
import { twoC2PConfigured, createPaymentToken } from "@/lib/2c2p";
import { reserveStock, releaseStock } from "@/lib/stock-reservation";
import { coupons, evaluateCoupon, CartLine } from "@/data/coupons";
import { getUserLoyalty } from "@/lib/user-tier";

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

// Splits a discount across cart lines proportional to each line's own
// subtotal share, rounding down and letting the last line absorb the
// remainder — same "last item absorbs rounding" technique already used
// for splitting a subscription charge across a set's items (see
// splitAmountByRealPrice in webhooks/2c2p/route.ts). Keeps quantities
// untouched, only reduces each line's per-unit price, so the stored
// line_items already reflect the discounted total the webhook later
// hands straight to Shopify — no discount-aware logic needed there.
function applyDiscount(lines: ResolvedLine[], discount: number): ResolvedLine[] {
  if (discount <= 0) return lines;
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  if (subtotal <= 0) return lines;
  let allocated = 0;
  return lines.map((l, i) => {
    const lineTotal = l.price * l.quantity;
    const isLast = i === lines.length - 1;
    const lineDiscount = isLast ? discount - allocated : Math.round((lineTotal / subtotal) * discount);
    allocated += lineDiscount;
    return { ...l, price: Math.round(((lineTotal - lineDiscount) / l.quantity) * 100) / 100 };
  });
}

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

  // Re-validate the coupon server-side against the resolved (real-price)
  // lines — never trust a discount amount the client claims. Uses the
  // exact same evaluateCoupon() the cart/checkout UI already runs, so an
  // eligible code always produces the same number here as what the
  // customer saw before submitting. An unknown/ineligible code is just
  // silently ignored (no discount) rather than failing checkout — the UI
  // already prevents selecting one that wouldn't qualify.
  let appliedCode: string | null = null;
  let discount = 0;
  if (typeof couponCode === "string" && couponCode) {
    const coupon = coupons.find((c) => c.code.toLowerCase() === couponCode.toLowerCase());
    if (coupon) {
      const tier = uid ? (await getUserLoyalty(uid)).tier : undefined;
      const cartLines: CartLine[] = resolved.map((l) => ({
        slug: l.slug,
        qty: l.quantity,
        price: l.price,
        brand: l.brand,
        category: l.category as CartLine["category"],
      }));
      const evaluation = evaluateCoupon(coupon, cartLines, { signedIn: Boolean(uid), tier });
      if (evaluation.eligible) {
        appliedCode = coupon.code;
        discount = evaluation.discount;
      }
    }
  }

  const discountedLines = applyDiscount(resolved, discount);
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
      line_items: discountedLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, price: l.price })),
      discount_code: appliedCode,
      discount_amount: discount,
    }),
  });

  const origin = req.nextUrl.origin;
  try {
    const result = await createPaymentToken({
      invoiceNo,
      description: `คำสั่งซื้อ Smoothlife.com (${resolved.length} รายการ)`.slice(0, 250),
      amount,
      paymentChannel: ["CC", "PPQR"],
      frontendReturnUrl: `${origin}/checkout/success?cartToken=${cartToken}`,
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

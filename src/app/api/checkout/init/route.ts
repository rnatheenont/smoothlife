import { NextRequest, NextResponse } from "next/server";
import { giftLinesForCheckout, type CheckoutGiftLine } from "@/lib/checkout-gifts";
import { orderDiscountForCheckout } from "@/lib/checkout-order-discount";
import type { CartLine } from "@/data/coupons";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { products } from "@/data/products";
import { twoC2PConfigured, createPaymentToken } from "@/lib/2c2p";
import { paymentChannelsFor } from "@/lib/payment-limits";
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

  const { lines, shippingAddress, email, phone, couponCode, giftChoices } = body;

  // Checked here, not only in the form.
  //
  // The form did check, and still a parcel can be addressed to nobody: a
  // field holding a single space passes `!value`, `"  ".trim().split()`
  // yields an empty first name, and the name was never looked at on this
  // side at all — so whatever arrived went to Shopify as the recipient.
  // Fifteen attempts in the last ninety days carried no name (all of them
  // failed before payment, so nothing shipped). This is the gate every path
  // to a payment page goes through, so it is the one that has to hold.
  const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const digitsOnly = (v: unknown) => trimmed(v).replace(/\D/g, "");

  if (
    !trimmed(shippingAddress?.address1) ||
    !trimmed(shippingAddress?.city) ||
    !trimmed(shippingAddress?.postalCode) ||
    !trimmed(shippingAddress?.countryCode)
  ) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกที่อยู่จัดส่งให้ครบ" }, { status: 400 });
  }

  // Whoever the courier asks for at the door.
  const recipient = [trimmed(shippingAddress?.firstName), trimmed(shippingAddress?.lastName)]
    .filter(Boolean)
    .join(" ");
  if (recipient.length < 2) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อผู้รับ" }, { status: 400 });
  }

  // Where the receipt goes, and every notice after it. Required because an
  // order with no email has the phone as its only thread back to the
  // customer — and an account made with a phone OTP has no email at all, so
  // "take whatever the account has" quietly meant "take none".
  const contactEmail = trimmed(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json(
      { ok: false, error: "กรุณากรอกอีเมลสำหรับรับใบเสร็จและแจ้งสถานะพัสดุ" },
      { status: 400 },
    );
  }

  // 9 for a landline, 10 for a mobile. Not a pattern beyond that: a shopper
  // typing their own number in their own format is not the place to be
  // clever, and the courier needs a number that can be dialled, not one
  // that matches a regex.
  const phoneDigits = digitsOnly(phone);
  if (phoneDigits.length < 9 || phoneDigits.length > 10) {
    return NextResponse.json(
      { ok: false, error: "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (9–10 หลัก)" },
      { status: 400 },
    );
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

  // The gifts this basket has earned, decided here rather than taken from the
  // browser — the cart shows them, and until the order carries them too the
  // "free" line the shopper saw was a promise nothing kept. They are priced at
  // zero, so they ride along without touching what is charged.
  // Which rewards the shopper picked, for campaigns that let them choose. The
  // browser's claim is narrowed against the campaign on the way through — it
  // can only ever take fewer gifts than the promo offers, never different ones.
  const chosen = new Map<string, string[]>();
  if (giftChoices && typeof giftChoices === "object" && !Array.isArray(giftChoices)) {
    for (const [slug, picks] of Object.entries(giftChoices as Record<string, unknown>)) {
      if (typeof slug !== "string" || !Array.isArray(picks)) continue;
      chosen.set(
        slug,
        picks.filter((v): v is string => typeof v === "string" && v.startsWith("gid://shopify/ProductVariant/")),
      );
    }
  }

  const gifts = await giftLinesForCheckout(
    resolved.map((l) => ({
      slug: l.slug,
      qty: l.quantity,
      price: l.price,
      brand: l.brand,
      category: l.category as CartLine["category"],
    })),
    chosen,
  ).catch((err) => {
    console.error("[checkout/init] gift evaluation failed", err);
    return [];
  });

  // The lines keep their real prices and the discount rides alongside them,
  // so the Shopify order can carry the code itself rather than a set of
  // quietly reduced prices no report can explain.
  // Rewards sold at a discount are part of what is charged; giveaways add
  // nothing. Leaving them out of the total would charge the card less than
  // the order says it is worth, and Shopify's order total is built from the
  // same lines.
  const giftTotal: number = (gifts as CheckoutGiftLine[]).reduce((sum, g) => sum + g.price * g.quantity, 0);

  // Money off the order from an Order Goal / Volume Discount campaign. Worked
  // out here from the lines this route resolved, never taken from the browser
  // — the cart showed the shopper a figure, and this is the one that is
  // charged.
  const campaign = await orderDiscountForCheckout(
    resolved.map((l) => ({
      slug: l.slug,
      qty: l.quantity,
      price: l.price,
      brand: l.brand,
      category: l.category as CartLine["category"],
    })),
  ).catch((err) => {
    console.error("[checkout/init] campaign discount failed", err);
    return null;
  });
  const campaignDiscount = Math.min(campaign?.amount ?? 0, Math.max(0, subtotal - discount));

  const amount = subtotal - discount - campaignDiscount + giftTotal + SHIPPING_FEE_THB;
  const invoiceNo = `CHKT${Date.now().toString(36).toUpperCase()}`.slice(0, 30);

  const [transaction] = await supabaseRest<{ id: string }[]>("payment_transactions", {
    method: "POST",
    body: JSON.stringify({
      cart_token: cartToken,
      user_id: uid ?? null,
      amount,
      invoice_no: invoiceNo,
      status: "pending",
      contact_email: contactEmail,
      // The digits, not whatever separators were typed around them — this
      // is the number support reads back and the courier dials.
      contact_phone: phoneDigits,
      shipping_address: shippingAddress,
      // The gifts go in here, because this column is what the webhook hands
      // to createPaidShopifyOrder once the payment lands. Nothing downstream
      // has to learn about gifts; the order simply has them.
      line_items: [
        ...resolved.map((l) => ({ variantId: l.variantId, quantity: l.quantity, price: l.price })),
        // promoSlug rides along so the webhook can tag the Shopify order with
        // the campaign that paid for the gift — it is the only place that
        // knowledge still exists by then.
        // The price comes from the rules, not a hard zero: a reward can be
        // sold at a discount rather than given away, and the order has to
        // charge what the cart showed.
        ...gifts.map((g) => ({
          variantId: g.variantId,
          quantity: g.quantity,
          price: g.price,
          promoSlug: g.promoSlug,
        })),
      ],
      discount_code: appliedCode,
      discount_amount: discount,
      // Kept apart from the coupon: one is a code the shopper typed, the
      // other is a campaign that fired on its own, and a refund has to be
      // able to tell them apart.
      campaign_discount_code: campaign?.promoSlug ?? null,
      campaign_discount_amount: campaignDiscount,
      ...attributionColumns(req.cookies.get(ATTRIBUTION_COOKIE)?.value),
    }),
  });

  const origin = req.nextUrl.origin;
  try {
    const result = await createPaymentToken({
      invoiceNo,
      description: `คำสั่งซื้อ Smoothlife.com (${resolved.length} รายการ)`.slice(0, 250),
      amount,
      // Which methods, and the ฿50,000 PromptPay ceiling with it, is
      // paymentChannelsFor's to decide — see @/lib/2c2p.
      paymentChannel: paymentChannelsFor(amount),
      frontendReturnUrl: `${origin}/api/payments/return?cartToken=${cartToken}`,
      backendReturnUrl: `${origin}/api/webhooks/2c2p-checkout`,
      customer: { email: contactEmail, mobileNo: phoneDigits },
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

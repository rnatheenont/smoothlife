import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isRateLimitedShared } from "@/lib/rate-limit";
import { createPaymentToken, twoC2PConfigured } from "@/lib/2c2p";
import { getProductBySlug } from "@/data/products";
import { startFlashSalePayment, UUID_RE } from "@/lib/flash-sale";
import {
  createFlashSaleShopifyCheckout,
  holdReservationForShopify,
  shopifyFlashSaleAvailable,
  type FlashSaleAddress,
} from "@/lib/flash-sale-shopify";
import { ATTRIBUTION_COOKIE, attributionColumns } from "@/lib/attribution";

// Opens a payment for the shopper's own live reservation (plan §5, §11.2).
// The price comes from the catalogue, never the request; the reservation is
// looked up from the session, so a payment can only ever be for the signed-in
// shopper's slot.
//
// Two places it can be paid, and the flash price decides which:
//
//   * the price is the shop's own price → Shopify's hosted checkout, which is
//     the only one of the two proven to carry this shop's larger amounts (see
//     flash-sale-shopify.ts). Shopify creates the order; orders/paid settles
//     the reservation.
//   * the price is a real discount → our 2C2P page, because Shopify's checkout
//     charges Shopify's price and nothing here can tell it otherwise. Its
//     payment page closes when the reservation does.

/** How long 2C2P's own payment page stays usable, at minimum. */
const PAYMENT_PAGE_MINUTES = 30;

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!twoC2PConfigured() && !shopifyFlashSaleAvailable()) {
    return NextResponse.json({ ok: false, error: "ระบบชำระเงินยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  if (await isRateLimitedShared(`fs-pay:${userId}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินบ่อยเกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const address: Partial<FlashSaleAddress> = body?.shippingAddress ?? {};
  if (!address.address1 || !address.city || !address.postalCode || !address.countryCode || !address.phone) {
    return NextResponse.json({ ok: false, error: "กรุณาเลือกที่อยู่จัดส่งให้ครบ" }, { status: 400 });
  }
  const clip = (v: string | undefined, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
  const shippingAddress: FlashSaleAddress = {
    firstName: clip(address.firstName, 100),
    lastName: clip(address.lastName, 100),
    address1: clip(address.address1, 300)!,
    city: clip(address.city, 100)!,
    state: clip(address.state, 100),
    postalCode: clip(address.postalCode, 20)!,
    countryCode: clip(address.countryCode, 2)!,
    phone: clip(address.phone, 30),
  };

  const started = await startFlashSalePayment(id, userId);
  if ("error" in started) {
    const msg = started.error === "too_late" ? "เหลือเวลาไม่พอสำหรับชำระเงิน (ต้องเหลืออย่างน้อย 1 นาที)" : "คุณยังไม่มีสิทธิ์จองในแคมเปญนี้";
    return NextResponse.json({ ok: false, error: msg }, { status: 409 });
  }

  // Read out before the closures below: narrowing "started" to its ok shape
  // does not survive being captured by one.
  const entryId = started.entry_id;
  const expiresAt = started.expires_at;

  const product = getProductBySlug(started.product_slug);
  const variant = product?.variants.find((v) => v.variantId === started.variant_id) ?? product?.variants.find((v) => v.variantId === product.variantId);
  if (!product || !variant) {
    console.error("[flash-sale/pay] product missing from catalogue", started.product_slug);
    return NextResponse.json({ ok: false, error: "ไม่พบสินค้า กรุณาติดต่อทีมงาน" }, { status: 500 });
  }

  const [email] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${pgValue(userId)}&provider=eq.email&select=provider_uid&limit=1`
  ).catch(() => []);
  const contactEmail = email?.provider_uid ?? null;

  const cartToken = crypto.randomUUID();
  const invoiceNo = `FS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 30);
  // The flash price fixed in the sale row when the campaign was created; the
  // regular price only for campaigns without one.
  const amount = started.sale_price !== null && started.sale_price !== undefined ? Number(started.sale_price) : variant.price;
  // Shopify's checkout charges Shopify's price. That is the right price when
  // the campaign never set one of its own, and the wrong one the moment it did.
  const viaShopify = shopifyFlashSaleAvailable() && Math.abs(amount - variant.price) < 0.005;

  /** The pending row every path needs: the monitor, the refund list, reconciliation. */
  async function recordPending(fields: Record<string, unknown>) {
    const [row] = await supabaseRest<{ id: string }[]>("payment_transactions", {
      method: "POST",
      body: JSON.stringify({
        cart_token: cartToken,
        user_id: userId,
        amount,
        invoice_no: invoiceNo,
        status: "pending",
        contact_email: contactEmail,
        contact_phone: shippingAddress.phone ?? null,
        shipping_address: shippingAddress,
        line_items: [{ variantId: variant!.variantId, quantity: 1, price: amount }],
        discount_amount: 0,
        flash_sale_entry_id: entryId,
        ...attributionColumns(req.cookies.get(ATTRIBUTION_COOKIE)?.value),
        ...fields,
      }),
    });
    return row;
  }

  /** No payment page exists, so the slot shouldn't be held past its time for one. */
  async function releaseHold(transactionId?: string) {
    if (transactionId) {
      await supabaseRest(`payment_transactions?id=eq.${pgValue(transactionId)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ status: "failed" }),
      }).catch(() => {});
    }
    await supabaseRest(`flash_sale_queue?id=eq.${pgValue(entryId)}&status=eq.reserved`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ payment_pending_until: null }),
    }).catch(() => {});
  }

  if (viaShopify) {
    let transactionId: string | undefined;
    try {
      const checkout = await createFlashSaleShopifyCheckout({
        entryId,
        variantId: variant.variantId,
        email: contactEmail,
        address: shippingAddress,
      });
      transactionId = (
        await recordPending({
          amount: checkout.amount,
          currency_code: checkout.currencyCode,
          shopify_cart_id: checkout.cartId,
          line_items: [{ variantId: variant.variantId, quantity: 1, price: checkout.amount }],
        })
      )?.id;
      // Only once there is a real checkout to go to.
      await holdReservationForShopify(entryId, expiresAt);
      // Shopify's checkout refuses to be framed, so the caller takes the whole
      // window there instead of opening PaymentModal over this page.
      return NextResponse.json({ ok: true, provider: "shopify", webPaymentUrl: checkout.checkoutUrl, cartToken });
    } catch (err) {
      console.error("[flash-sale/pay] Shopify checkout failed", err);
      await releaseHold(transactionId);
      return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
    }
  }

  if (!twoC2PConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบชำระเงินยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const transaction = await recordPending({});
  const origin = req.nextUrl.origin;
  try {
    const result = await createPaymentToken({
      invoiceNo,
      description: `Flash Sale: ${product.name}`.slice(0, 250),
      amount,
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
      backendReturnUrl: `${origin}/api/webhooks/2c2p-flash-sale`,
      customer: { email: contactEmail ?? undefined, mobileNo: shippingAddress.phone },
      shippingAddress,
      // Not the reservation's own deadline. A shopper who presses pay with
      // two minutes left handed 2C2P a two-minute window to load a page,
      // choose a method, receive an OTP and answer it — and one who pressed
      // with thirty-six seconds left handed it thirty-six. The queue still
      // decides who gets the item; this only decides how long the payment
      // page itself stays alive, and a charge that lands after the slot is
      // gone is already handled (settleFlashSaleCharge flags it to refund).
      paymentExpiry: new Date(Math.max(Date.parse(started.expires_at), Date.now() + PAYMENT_PAGE_MINUTES * 60_000)),
    });
    return NextResponse.json({ ok: true, provider: "2c2p", webPaymentUrl: result.webPaymentUrl, cartToken });
  } catch (err) {
    console.error("[flash-sale/pay] 2C2P paymentToken failed", err);
    await releaseHold(transaction?.id);
    return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }
}

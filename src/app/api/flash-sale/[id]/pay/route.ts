import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isRateLimitedShared } from "@/lib/rate-limit";
import { createPaymentToken, twoC2PConfigured } from "@/lib/2c2p";
import { getProductBySlug } from "@/data/products";
import { startFlashSalePayment, UUID_RE } from "@/lib/flash-sale";
import { ATTRIBUTION_COOKIE, attributionColumns } from "@/lib/attribution";

// Opens a 2C2P payment for the shopper's own live reservation (plan §5, §11.2).
// The price comes from the catalogue, never the request; the reservation is
// looked up from the session, so a payment can only ever be for the signed-in
// shopper's slot. 2C2P's payment page closes when the reservation does.

type AddressInput = {
  firstName?: string;
  lastName?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  phone?: string;
};

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!twoC2PConfigured()) return NextResponse.json({ ok: false, error: "ระบบชำระเงินยังไม่พร้อมใช้งาน" }, { status: 503 });

  if (await isRateLimitedShared(`fs-pay:${userId}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินบ่อยเกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const address: AddressInput = body?.shippingAddress ?? {};
  if (!address.address1 || !address.city || !address.postalCode || !address.countryCode || !address.phone) {
    return NextResponse.json({ ok: false, error: "กรุณาเลือกที่อยู่จัดส่งให้ครบ" }, { status: 400 });
  }
  const clip = (v: string | undefined, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
  const shippingAddress = {
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

  const product = getProductBySlug(started.product_slug);
  const variant = product?.variants.find((v) => v.variantId === started.variant_id) ?? product?.variants.find((v) => v.variantId === product.variantId);
  if (!product || !variant) {
    console.error("[flash-sale/pay] product missing from catalogue", started.product_slug);
    return NextResponse.json({ ok: false, error: "ไม่พบสินค้า กรุณาติดต่อทีมงาน" }, { status: 500 });
  }

  const [email] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${pgValue(userId)}&provider=eq.email&select=provider_uid&limit=1`
  ).catch(() => []);

  const cartToken = crypto.randomUUID();
  const invoiceNo = `FS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 30);
  // The flash price fixed in the sale row when the campaign was created; the
  // regular price only for campaigns without one.
  const amount = started.sale_price !== null && started.sale_price !== undefined ? Number(started.sale_price) : variant.price;

  const [transaction] = await supabaseRest<{ id: string }[]>("payment_transactions", {
    method: "POST",
    body: JSON.stringify({
      cart_token: cartToken,
      user_id: userId,
      amount,
      invoice_no: invoiceNo,
      status: "pending",
      contact_email: email?.provider_uid ?? null,
      contact_phone: shippingAddress.phone ?? null,
      shipping_address: shippingAddress,
      line_items: [{ variantId: variant.variantId, quantity: 1, price: amount }],
      discount_amount: 0,
      flash_sale_entry_id: started.entry_id,
      ...attributionColumns(req.cookies.get(ATTRIBUTION_COOKIE)?.value),
    }),
  });

  const origin = req.nextUrl.origin;
  try {
    const result = await createPaymentToken({
      invoiceNo,
      description: `Flash Sale: ${product.name}`.slice(0, 250),
      amount,
      paymentChannel: ["CC", "PPQR"],
      frontendReturnUrl: `${origin}/checkout/success?cartToken=${cartToken}`,
      backendReturnUrl: `${origin}/api/webhooks/2c2p-flash-sale`,
      customer: { email: email?.provider_uid, mobileNo: shippingAddress.phone },
      shippingAddress,
      paymentExpiry: new Date(started.expires_at),
    });
    return NextResponse.json({ ok: true, webPaymentUrl: result.webPaymentUrl, cartToken });
  } catch (err) {
    console.error("[flash-sale/pay] 2C2P paymentToken failed", err);
    await supabaseRest(`payment_transactions?id=eq.${pgValue(transaction.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "failed" }),
    }).catch(() => {});
    // No payment page exists, so the slot shouldn't be held past its time for one.
    await supabaseRest(`flash_sale_queue?id=eq.${pgValue(started.entry_id)}&status=eq.reserved`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ payment_pending_until: null }),
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }
}

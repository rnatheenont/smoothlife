import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { products } from "@/data/products";
import { subscriptionPlans } from "@/data/subscriptions";
import { twoC2PConfigured, createRecurringPaymentToken } from "@/lib/2c2p";

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }
  if (!twoC2PConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบตัดเงินอัตโนมัติยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const { productSlug, variantId, months, shippingAddress } = body;
  const plan = subscriptionPlans.find((p) => p.months === months);
  if (!plan) return NextResponse.json({ ok: false, error: "ระยะเวลาสมัครไม่ถูกต้อง" }, { status: 400 });

  const product = products.find((p) => p.slug === productSlug);
  const variant = product?.variants.find((v) => v.variantId === variantId);
  if (!product || !variant) return NextResponse.json({ ok: false, error: "ไม่พบสินค้านี้" }, { status: 404 });

  if (
    !shippingAddress?.address1 ||
    !shippingAddress?.city ||
    !shippingAddress?.postalCode ||
    !shippingAddress?.countryCode
  ) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกที่อยู่จัดส่งให้ครบ" }, { status: 400 });
  }

  const [user] = await supabaseRest<{ id: string; display_name: string | null; phone: string | null }[]>(
    `users?id=eq.${uid}&select=id,display_name,phone`
  );
  const [emailIdentity] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid`
  );

  const amountPerCycle = Math.round(variant.price * (1 - plan.discountPct / 100));
  const invoicePrefix = `SUB${Date.now().toString(36).toUpperCase()}`.slice(0, 15);
  const invoiceNo = `${invoicePrefix}1`;
  const chargeNextDate = new Date();
  chargeNextDate.setMonth(chargeNextDate.getMonth() + 1);

  const [subscription] = await supabaseRest<{ id: string }[]>("real_subscriptions", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      status: "pending",
      product_slug: product.slug,
      product_name: product.name,
      variant_id: variant.variantId,
      plan_months: plan.months,
      discount_pct: plan.discountPct,
      amount_per_cycle: amountPerCycle,
      currency_code: "THB",
      invoice_prefix: invoicePrefix,
      cycles_total: plan.months,
      shipping_address: shippingAddress,
      contact_email: emailIdentity?.provider_uid ?? null,
      contact_phone: user?.phone ?? null,
    }),
  });

  await supabaseRest("real_subscription_charges", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      subscription_id: subscription.id,
      invoice_no: invoiceNo,
      cycle_number: 1,
      amount: amountPerCycle,
    }),
  });

  const origin = req.nextUrl.origin;
  try {
    const result = await createRecurringPaymentToken({
      invoiceNo,
      invoicePrefix,
      description: `${product.name} (สมัครรับประจำทุก ${plan.months} เดือน)`.slice(0, 250),
      amountPerCycle,
      recurringCount: plan.months,
      chargeNextDate,
      frontendReturnUrl: `${origin}/account/subscriptions?justSubscribed=1`,
      backendReturnUrl: `${origin}/api/webhooks/2c2p`,
      customer: { name: user?.display_name ?? undefined, email: emailIdentity?.provider_uid, mobileNo: user?.phone ?? undefined },
      shippingAddress: {
        address1: shippingAddress.address1,
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode,
        countryCode: shippingAddress.countryCode,
        state: shippingAddress.state,
      },
    });
    return NextResponse.json({ ok: true, webPaymentUrl: result.webPaymentUrl });
  } catch (err) {
    console.error("[subscribe/checkout] 2C2P paymentToken failed", err);
    await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "cancelled" }),
    });
    return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }
}

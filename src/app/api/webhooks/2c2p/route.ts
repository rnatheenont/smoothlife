import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { twoC2PConfigured, verifyPaymentCallback } from "@/lib/2c2p";
import { createOrderForSubscriptionCycle } from "@/lib/shopify-admin";

type ChargeRow = { id: string; subscription_id: string; cycle_number: number; amount: number };
type SubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  product_name: string;
  variant_id: string;
  plan_months: number;
  cycles_total: number;
  cycles_completed: number;
  currency_code: string;
  invoice_prefix: string;
  contact_email: string | null;
  shipping_address: {
    firstName?: string;
    lastName?: string;
    address1: string;
    city: string;
    postalCode: string;
    countryCode: string;
    state?: string;
    phone?: string;
  };
};

// backendReturnUrl for 2C2P — fires once for the first (browser-initiated)
// charge and again automatically for every subsequent recurring cycle,
// since 2C2P reuses this same URL for both. There's no Shopify order or
// checkout involved at all until a charge actually succeeds here — this
// route is what tells Shopify a sale happened, not the other way around.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !twoC2PConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 200 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.payload) return NextResponse.json({ ok: false, error: "missing payload" }, { status: 200 });

  let callback;
  try {
    callback = verifyPaymentCallback(body.payload);
  } catch (err) {
    console.error("[webhooks/2c2p] signature verification failed", err);
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 200 });
  }

  const success = callback.respCode === "0000";

  let [charge] = await supabaseRest<ChargeRow[]>(`real_subscription_charges?invoice_no=eq.${callback.invoiceNo}&select=id,subscription_id,cycle_number,amount`);

  if (!charge) {
    // A recurring cycle we didn't pre-create a row for — 2C2P generates its
    // own invoiceNo per auto-charge (invoicePrefix + 5 digits), so the
    // first time we see a given cycle is right here.
    const prefix = callback.invoiceNo.slice(0, -5);
    const [subscription] = await supabaseRest<{ id: string; cycles_completed: number }[]>(
      `real_subscriptions?invoice_prefix=eq.${prefix}&select=id,cycles_completed`
    );
    if (!subscription) {
      console.error("[webhooks/2c2p] no subscription matches invoice", callback.invoiceNo);
      return NextResponse.json({ ok: false, error: "unknown subscription" }, { status: 200 });
    }
    const [created] = await supabaseRest<ChargeRow[]>("real_subscription_charges", {
      method: "POST",
      body: JSON.stringify({
        subscription_id: subscription.id,
        invoice_no: callback.invoiceNo,
        cycle_number: subscription.cycles_completed + 1,
        amount: callback.amount,
      }),
    });
    charge = created;
  }

  await supabaseRest(`real_subscription_charges?id=eq.${charge.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      tran_ref: callback.tranRef,
      resp_code: callback.respCode,
      resp_desc: callback.respDesc,
      success,
      charged_at: new Date().toISOString(),
    }),
  });

  const [subscription] = await supabaseRest<SubscriptionRow[]>(
    `real_subscriptions?id=eq.${charge.subscription_id}&select=id,user_id,status,product_name,variant_id,plan_months,cycles_total,cycles_completed,currency_code,invoice_prefix,contact_email,shipping_address`
  );
  if (!subscription) return NextResponse.json({ ok: false, error: "subscription not found" }, { status: 200 });

  if (!success) {
    await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: subscription.status === "pending" ? "cancelled" : "past_due", updated_at: new Date().toISOString() }),
    });
    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: subscription.user_id,
        type: "subscription_charge_failed",
        title: "ตัดเงินสำหรับการสมัครไม่สำเร็จ",
        body: `${subscription.product_name} — กรุณาตรวจสอบบัตรของคุณ`,
        link: "/account/subscriptions",
      }),
    });
    return NextResponse.json({ ok: true, result: "charge_failed" });
  }

  const cyclesCompleted = charge.cycle_number;
  const nextChargeDate = new Date();
  nextChargeDate.setMonth(nextChargeDate.getMonth() + 1);
  const completed = cyclesCompleted >= subscription.cycles_total;

  await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: completed ? "completed" : "active",
      cycles_completed: cyclesCompleted,
      next_charge_date: completed ? null : nextChargeDate.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }),
  });

  try {
    const addr = subscription.shipping_address;
    const order = await createOrderForSubscriptionCycle({
      email: subscription.contact_email ?? undefined,
      variantId: subscription.variant_id,
      quantity: 1,
      amount: charge.amount,
      currencyCode: subscription.currency_code,
      shippingAddress: {
        firstName: addr.firstName,
        lastName: addr.lastName,
        address1: addr.address1,
        city: addr.city,
        provinceCode: addr.state,
        zip: addr.postalCode,
        countryCode: addr.countryCode,
        phone: addr.phone,
      },
      note: `Subscribe & Save — รอบที่ ${charge.cycle_number}/${subscription.cycles_total}`,
      tranRef: callback.tranRef,
    });
    await supabaseRest(`real_subscription_charges?id=eq.${charge.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_order_id: order.id }),
    });
  } catch (err) {
    // Payment already succeeded — never let a Shopify-side failure make us
    // report the charge itself as failed. Logged for manual follow-up; the
    // customer was charged and is owed a shipment regardless.
    console.error("[webhooks/2c2p] charge succeeded but Shopify order creation failed", err);
  }

  await supabaseRest("notifications", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: subscription.user_id,
      type: "subscription_charged",
      title: completed ? "การสมัครของคุณครบรอบแล้ว" : "ตัดเงินสำเร็จ กำลังจัดส่งรอบถัดไป",
      body: `${subscription.product_name} — รอบที่ ${charge.cycle_number}/${subscription.cycles_total}`,
      link: "/account/subscriptions",
    }),
  });

  return NextResponse.json({ ok: true, result: "charge_succeeded" });
}

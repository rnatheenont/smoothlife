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
// charge and again automatically for every subsequent term renewal, since
// recurringCount:0 (lib/2c2p.ts) makes 2C2P keep charging the same term
// length/amount forever until cancelRecurringPlan() is called. Each
// successful charge here = "a new term started" — it creates ONLY that
// term's first shipment; months 2..N of the term are created later by the
// monthly fulfillment cron (cron/subscription-fulfillment), never by
// another charge, since there isn't one until the term ends.
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
    // A term renewal we didn't pre-create a row for — 2C2P generates its
    // own invoiceNo per auto-charge (invoicePrefix + 5 digits), so the
    // first time we see a given term's charge is right here.
    const prefix = callback.invoiceNo.slice(0, -5);
    const [subscription] = await supabaseRest<{ id: string; current_term_number: number }[]>(
      `real_subscriptions?invoice_prefix=eq.${prefix}&select=id,current_term_number`
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
        cycle_number: subscription.current_term_number + 1,
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
    `real_subscriptions?id=eq.${charge.subscription_id}&select=id,user_id,status,product_name,variant_id,plan_months,currency_code,invoice_prefix,contact_email,shipping_address`
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

  // charge.cycle_number counts "which charge is this for this
  // subscription" — under the term model that's exactly the term number
  // (1 = first charge/term, 2 = first renewal/second term, ...).
  const termNumber = charge.cycle_number;
  const nextChargeDate = new Date();
  nextChargeDate.setMonth(nextChargeDate.getMonth() + subscription.plan_months);

  await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "active",
      current_term_number: termNumber,
      cycles_completed_this_term: 0,
      next_charge_date: nextChargeDate.toISOString().slice(0, 10),
      renewal_notified_at: null, // this term's renewal reminder hasn't fired yet
      // Needed to ever cancel this plan later (lib/2c2p.ts's
      // cancelRecurringPlan) — not present on every callback per 2C2P's
      // docs, so only overwrite when this one actually carries it.
      ...(callback.recurringUniqueID ? { recurring_unique_id: callback.recurringUniqueID } : {}),
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
      note: `Subscribe & Save — เทอมที่ ${termNumber} (${subscription.plan_months} เดือน) รอบจัดส่งที่ 1/${subscription.plan_months}`,
      tranRef: callback.tranRef,
    });
    await supabaseRest(`real_subscription_charges?id=eq.${charge.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_order_id: order.id }),
    });
    await supabaseRest("subscription_shipments", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        subscription_id: subscription.id,
        term_number: termNumber,
        cycle_in_term: 1,
        shopify_order_id: order.id,
      }),
    });
    const nextShipmentDate = new Date();
    nextShipmentDate.setMonth(nextShipmentDate.getMonth() + 1);
    await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        cycles_completed_this_term: 1,
        next_shipment_date: subscription.plan_months > 1 ? nextShipmentDate.toISOString().slice(0, 10) : null,
      }),
    });
  } catch (err) {
    // Payment already succeeded — never let a Shopify-side failure make us
    // report the charge itself as failed. Logged for manual follow-up; the
    // customer was charged and is owed a shipment regardless. Left with
    // cycles_completed_this_term: 0 / next_shipment_date unset so nothing
    // else in the term proceeds until someone fixes this manually.
    console.error("[webhooks/2c2p] charge succeeded but Shopify order creation failed", err);
  }

  await supabaseRest("notifications", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: subscription.user_id,
      type: "subscription_charged",
      title: termNumber === 1 ? "สมัครสมาชิกสำเร็จ" : "ต่ออายุสมาชิกสำเร็จ",
      body: `${subscription.product_name} — เทอมที่ ${termNumber} (${subscription.plan_months} เดือน) เริ่มจัดส่งแล้ว`,
      link: "/account/subscriptions",
    }),
  });

  return NextResponse.json({ ok: true, result: "charge_succeeded" });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { twoC2PConfigured, verifyPaymentCallback } from "@/lib/2c2p";
import { createPaidShopifyOrder } from "@/lib/shopify-admin";
import { products } from "@/data/products";

type ChargeRow = { id: string; subscription_id: string; cycle_number: number; amount: number };
type SubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  subscription_type: "single_product" | "set" | "custom_bundle";
  product_name: string;
  variant_id: string | null;
  variant_ids: string[] | null;
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

// Splits a term's total charge across a set's items in proportion to each
// item's own catalog price, rounding the last one to absorb the remainder
// so the parts always sum to exactly `totalAmount` — Shopify rejects an
// order whose line items don't reconcile with its recorded transaction.
function splitAmountByRealPrice(variantIds: string[], totalAmount: number): { variantId: string; price: number }[] {
  const catalogPrices = variantIds.map((vid) => {
    const product = products.find((p) => p.variants.some((v) => v.variantId === vid));
    const variant = product?.variants.find((v) => v.variantId === vid);
    return variant?.price ?? 0;
  });
  const priceSum = catalogPrices.reduce((s, p) => s + p, 0) || 1;
  let allocated = 0;
  return variantIds.map((variantId, i) => {
    const isLast = i === variantIds.length - 1;
    const price = isLast ? totalAmount - allocated : Math.round((catalogPrices[i] / priceSum) * totalAmount);
    allocated += price;
    return { variantId, price };
  });
}

// backendReturnUrl for 2C2P — fires once for the first (browser-initiated)
// charge and again automatically every ~30 days after, since
// recurringCount:0 (lib/2c2p.ts) makes 2C2P keep charging the same monthly
// amount indefinitely until cancelRecurringPlan() is called. Every firing
// is a real charge for exactly one month — this handler creates that
// month's Shopify order directly, there is no separate fulfillment cron
// involved anymore (nothing is ever prepaid ahead of what's charged here).
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
    // An auto-fired monthly renewal we didn't pre-create a row for — 2C2P
    // generates its own invoiceNo per auto-charge (invoicePrefix + 5
    // digits), so the first time we see a given cycle's charge is right
    // here. cycle_number is the lifetime charge count for this
    // subscription (never resets) — derived from the ledger's own max
    // rather than a mutable counter on real_subscriptions, so it
    // self-heals even if a prior write here ever partially failed.
    const prefix = callback.invoiceNo.slice(0, -5);
    const [subscription] = await supabaseRest<{ id: string }[]>(
      `real_subscriptions?invoice_prefix=eq.${prefix}&select=id`
    );
    if (!subscription) {
      console.error("[webhooks/2c2p] no subscription matches invoice", callback.invoiceNo);
      return NextResponse.json({ ok: false, error: "unknown subscription" }, { status: 200 });
    }
    const [lastCharge] = await supabaseRest<{ cycle_number: number }[]>(
      `real_subscription_charges?subscription_id=eq.${subscription.id}&select=cycle_number&order=cycle_number.desc&limit=1`
    );
    const [created] = await supabaseRest<ChargeRow[]>("real_subscription_charges", {
      method: "POST",
      body: JSON.stringify({
        subscription_id: subscription.id,
        invoice_no: callback.invoiceNo,
        cycle_number: (lastCharge?.cycle_number ?? 0) + 1,
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
    `real_subscriptions?id=eq.${charge.subscription_id}&select=id,user_id,status,subscription_type,product_name,variant_id,variant_ids,plan_months,currency_code,invoice_prefix,contact_email,shipping_address`
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

  // charge.cycle_number is the lifetime charge count for this
  // subscription (never resets). Derive which cycle-within-the-term this
  // is (wraps 1..plan_months, i.e. auto-renews into a new term once it
  // exceeds plan_months) and which term/generation this is, purely from
  // that immutable ledger value — no separate mutable counter to drift.
  const cycleInTerm = ((charge.cycle_number - 1) % subscription.plan_months) + 1;
  const termNumber = Math.floor((charge.cycle_number - 1) / subscription.plan_months) + 1;
  const nextChargeDate = new Date();
  nextChargeDate.setMonth(nextChargeDate.getMonth() + 1);

  await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "active",
      current_term_number: termNumber,
      cycle_in_term: cycleInTerm,
      next_charge_date: nextChargeDate.toISOString().slice(0, 10),
      renewal_notified_at: null, // this cycle's reminder hasn't fired yet
      // Needed to ever cancel this plan later (lib/2c2p.ts's
      // cancelRecurringPlan) — not present on every callback per 2C2P's
      // docs, so only overwrite when this one actually carries it.
      ...(callback.recurringUniqueID ? { recurring_unique_id: callback.recurringUniqueID } : {}),
      updated_at: new Date().toISOString(),
    }),
  });

  try {
    const addr = subscription.shipping_address;
    const lineItems =
      (subscription.subscription_type === "set" || subscription.subscription_type === "custom_bundle") &&
      subscription.variant_ids
        ? splitAmountByRealPrice(subscription.variant_ids, charge.amount).map((li) => ({ ...li, quantity: 1 }))
        : [{ variantId: subscription.variant_id!, quantity: 1, price: charge.amount }];
    const order = await createPaidShopifyOrder({
      email: subscription.contact_email ?? undefined,
      lineItems,
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
      note: `Subscribe & Save — รอบตัดเงินเดือนที่ ${cycleInTerm}/${subscription.plan_months} (เทอมที่ ${termNumber})`,
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
        cycle_in_term: cycleInTerm,
        shopify_order_id: order.id,
      }),
    });
  } catch (err) {
    // Payment already succeeded — never let a Shopify-side failure make us
    // report the charge itself as failed. Logged for manual follow-up; the
    // customer was charged and is owed this month's shipment regardless.
    console.error("[webhooks/2c2p] charge succeeded but Shopify order creation failed", err);
  }

  await supabaseRest("notifications", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: subscription.user_id,
      type: "subscription_charged",
      title: charge.cycle_number === 1 ? "สมัครสมาชิกสำเร็จ" : cycleInTerm === 1 ? "ต่ออายุเทอมใหม่สำเร็จ" : "ตัดเงินรายเดือนสำเร็จ",
      body: `${subscription.product_name} — รอบที่ ${cycleInTerm}/${subscription.plan_months} (เทอมที่ ${termNumber}) จัดส่งแล้ว`,
      link: "/account/subscriptions",
    }),
  });

  return NextResponse.json({ ok: true, result: "charge_succeeded" });
}

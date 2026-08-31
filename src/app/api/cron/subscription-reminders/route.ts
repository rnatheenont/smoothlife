import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getVariantAvailability, shopifyAdminConfigured, createFulfillmentOnlyOrder } from "@/lib/shopify-admin";
import { cancelRecurringPlan, recurringMaintenanceConfigured } from "@/lib/2c2p";
import { expireStaleReferrals, releaseMaturedReferralRewards, advanceOrderPlacedReferrals } from "@/lib/referral-cron";
import { recalculateLoyaltyTiers } from "@/lib/loyalty-cron";
import { awardBirthdayRewards } from "@/lib/birthday-cron";
import { expirePoints } from "@/lib/points-expiry-cron";

const RENEWAL_NOTICE_DAYS = 7;

const REMINDER_WINDOW_DAYS = 3;
// 2C2P charges each cycle automatically on its own schedule — we're never
// asked first, so there's no hook to check stock "before" a charge fires.
// The only real lever we have is to cancel the plan *before that date
// arrives* if the item is already out of stock, so 2C2P never attempts
// the charge in the first place. This window just needs to comfortably
// clear this cron's own daily cadence (see vercel.json) so no subscription
// slips through between checks.
const STOCK_CHECK_WINDOW_DAYS = 2;

type DueSubscription = {
  id: string;
  user_id: string;
  product_name: string;
  product_slug: string;
  plan_months: number;
  next_renewal_at: string;
};

type RealSubscriptionDue = {
  id: string;
  user_id: string;
  product_name: string;
  product_slug: string;
  variant_id: string;
  recurring_unique_id: string | null;
  amount_per_cycle: number;
};

// Real subscriptions (2C2P recurring billing) whose next charge is coming
// up soon — cancel any that are genuinely out of stock so the customer is
// never charged for something we can't ship. Best-effort: any row we can't
// confidently verify (API unreachable, no recurring_unique_id yet, cancel
// itself fails) is left untouched rather than guessed at, since acting on
// bad data here risks the opposite mistake — stopping a plan that's fine.
async function cancelOutOfStockSubscriptions() {
  if (!shopifyAdminConfigured() || !recurringMaintenanceConfigured()) return 0;

  const windowEnd = new Date(Date.now() + STOCK_CHECK_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const due = await supabaseRest<RealSubscriptionDue[]>(
    `real_subscriptions?status=eq.active&next_charge_date=lte.${windowEnd}&select=id,user_id,product_name,product_slug,variant_id,recurring_unique_id,amount_per_cycle`
  );

  let cancelled = 0;
  for (const sub of due) {
    if (!sub.recurring_unique_id) continue;

    const availability = await getVariantAvailability(sub.variant_id);
    if (!availability) continue; // couldn't verify — don't act on it

    const outOfStock =
      !availability.availableForSale ||
      (availability.inventoryPolicy === "DENY" && availability.inventoryQuantity !== null && availability.inventoryQuantity <= 0);
    if (!outOfStock) continue;

    const result = await cancelRecurringPlan(sub.recurring_unique_id, sub.amount_per_cycle);
    if (result.respCode !== "00") {
      console.error(
        `[cron/subscription-reminders] 2C2P refused to cancel out-of-stock subscription ${sub.id}: ${result.respCode} ${result.respReason}`
      );
      continue; // left as "active" — 2C2P still thinks it's live, don't claim otherwise
    }

    await supabaseRest(`real_subscriptions?id=eq.${sub.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
    });
    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: sub.user_id,
        type: "subscription_out_of_stock",
        title: "ยกเลิกการสมัครอัตโนมัติ — สินค้าหมดสต็อก",
        body: `${sub.product_name} หมดสต็อกชั่วคราว ระบบยกเลิกรอบตัดเงินถัดไปให้แล้ว ไม่มีการเก็บเงินเพิ่ม สมัครใหม่ได้เมื่อสินค้ากลับมามีสต็อก`,
        link: `/product/${sub.product_slug}`,
        metadata: { subscriptionId: sub.id },
      }),
    });
    cancelled++;
  }
  return cancelled;
}

type ShipmentDue = {
  id: string;
  user_id: string;
  product_name: string;
  variant_id: string | null;
  variant_ids: string[] | null;
  plan_months: number;
  current_term_number: number;
  cycles_completed_this_term: number;
  auto_renew_cancelled: boolean;
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

// Months 2..N of an already-paid term — month 1 of each term is created
// immediately by the 2C2P webhook (that's the one order tied to the actual
// charge). This is pure fulfillment: no payment happens here, so each
// order carries a $0 line item (see createFulfillmentOnlyOrder) rather than
// re-recording the term's lump sum every month.
async function createDueShipments() {
  if (!shopifyAdminConfigured()) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const due = await supabaseRest<ShipmentDue[]>(
    `real_subscriptions?status=in.(active,past_due)&next_shipment_date=lte.${today}&select=id,user_id,product_name,variant_id,variant_ids,plan_months,current_term_number,cycles_completed_this_term,auto_renew_cancelled,contact_email,shipping_address`
  );

  let shipped = 0;
  for (const sub of due) {
    const cycleInTerm = sub.cycles_completed_this_term + 1;
    if (cycleInTerm > sub.plan_months) continue; // already fully shipped — shouldn't happen, but never over-ship

    try {
      const addr = sub.shipping_address;
      const lineItems = sub.variant_ids
        ? sub.variant_ids.map((variantId) => ({ variantId, quantity: 1 }))
        : [{ variantId: sub.variant_id!, quantity: 1 }];
      const order = await createFulfillmentOnlyOrder({
        email: sub.contact_email ?? undefined,
        lineItems,
        currencyCode: "THB",
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
        note: `Subscribe & Save — เทอมที่ ${sub.current_term_number} (${sub.plan_months} เดือน) รอบจัดส่งที่ ${cycleInTerm}/${sub.plan_months}`,
      });
      await supabaseRest("subscription_shipments", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          subscription_id: sub.id,
          term_number: sub.current_term_number,
          cycle_in_term: cycleInTerm,
          shopify_order_id: order.id,
        }),
      });

      const termFinished = cycleInTerm >= sub.plan_months;
      let nextShipmentDate: string | null = null;
      if (!termFinished) {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        nextShipmentDate = d.toISOString().slice(0, 10);
      }
      await supabaseRest(`real_subscriptions?id=eq.${sub.id}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({
          cycles_completed_this_term: cycleInTerm,
          next_shipment_date: nextShipmentDate,
          // Term fully shipped and the customer already cancelled renewal
          // (src/app/api/subscribe/[id]/cancel) — nothing left owed to
          // them, safe to close out. Otherwise leave status alone; it
          // stays active waiting for 2C2P's next term-renewal charge.
          ...(termFinished && sub.auto_renew_cancelled ? { status: "ended" } : {}),
          updated_at: new Date().toISOString(),
        }),
      });
      shipped++;
    } catch (err) {
      // Left with the same next_shipment_date so it's retried tomorrow
      // rather than silently skipped.
      console.error(`[cron/subscription-reminders] shipment order failed for subscription ${sub.id}`, err);
    }
  }
  return shipped;
}

type RenewalDue = {
  id: string;
  user_id: string;
  product_name: string;
  plan_months: number;
  amount_per_cycle: number;
};

// 7 days' notice (RENEWAL_NOTICE_DAYS) before the next lump-sum term
// charge fires — the amount is large (a whole term paid at once), so this
// is a real heads-up, not a courtesy ping. renewal_notified_at is cleared
// by the webhook on every successful charge, so this fires again for each
// new term rather than only once ever.
async function notifyUpcomingRenewals() {
  const windowEnd = new Date(Date.now() + RENEWAL_NOTICE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const due = await supabaseRest<RenewalDue[]>(
    `real_subscriptions?status=eq.active&auto_renew_cancelled=eq.false&renewal_notified_at=is.null&next_charge_date=lte.${windowEnd}&select=id,user_id,product_name,plan_months,amount_per_cycle`
  );

  let notified = 0;
  for (const sub of due) {
    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: sub.user_id,
        type: "subscription_renewal_charge",
        title: "ใกล้ถึงรอบต่ออายุสมาชิกแล้ว",
        body: `${sub.product_name} จะตัดเงิน ${sub.amount_per_cycle.toLocaleString()} บาท เพื่อต่ออายุอีก ${sub.plan_months} เดือน ภายใน ${RENEWAL_NOTICE_DAYS} วัน หากไม่ต้องการต่ออายุ ยกเลิกได้ในหน้าการสมัครสมาชิก`,
        link: "/account/subscriptions",
        metadata: { subscriptionId: sub.id },
      }),
    });
    await supabaseRest(`real_subscriptions?id=eq.${sub.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ renewal_notified_at: new Date().toISOString() }),
    });
    notified++;
  }
  return notified;
}

// Daily cron (see vercel.json) — the automatic half of "auto subscription":
// there's no real recurring charge to fire for the interim tracker, so
// this is what actually runs on its own without the customer doing
// anything, nudging them to repurchase before their current term's supply
// runs out. Each row is only ever reminded once (reminded_at gate) even if
// this runs more than once on the same day. Also covers, for the real
// (2C2P) term-based subscriptions: the pre-charge stock check
// (cancelOutOfStockSubscriptions), monthly shipment fulfillment
// (createDueShipments — the only recurring work billing doesn't already
// trigger, since 2C2P only fires once per term, not once per month), and
// the pre-renewal notice (notifyUpcomingRenewals), and the referral
// programme's daily housekeeping — advancing order_placed referrals whose
// order has since shipped (a poll fallback so this doesn't depend on the
// "orders/fulfilled" webhook topic ever being subscribed in Shopify),
// expiring stale click-throughs, and releasing matured rewards — see
// @/lib/referral-cron — plus the loyalty tier recalculation (rolling
// 12-month spend/orders, upgrade/downgrade with a 90-day grace period —
// see @/lib/loyalty-cron), the birthday bonus scan (see
// @/lib/birthday-cron), and points expiry — 12 months per batch, FIFO
// (see @/lib/points-expiry-cron). All bundled into this one job since the
// Vercel Hobby plan caps cron jobs at 2 total and both slots are already
// spoken for.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 200 });
  }

  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const due = await supabaseRest<DueSubscription[]>(
    `subscription_preferences?active=eq.true&reminded_at=is.null&next_renewal_at=lte.${windowEnd}&select=id,user_id,product_name,product_slug,plan_months,next_renewal_at`
  );

  let notified = 0;
  for (const sub of due) {
    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: sub.user_id,
        type: "subscription_renewal",
        title: "การสมัครของคุณใกล้ครบรอบแล้ว",
        body: `${sub.product_name} จะครบรอบ ${sub.plan_months} เดือนเร็วๆ นี้ — สั่งซื้ออีกครั้งเพื่อรับส่วนลดต่อเนื่อง`,
        link: `/product/${sub.product_slug}`,
        metadata: { subscriptionId: sub.id },
      }),
    });
    await supabaseRest(`subscription_preferences?id=eq.${sub.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ reminded_at: new Date().toISOString() }),
    });
    notified++;
  }

  const stockCancelled = await cancelOutOfStockSubscriptions();
  const shipmentsCreated = await createDueShipments();
  const renewalsNotified = await notifyUpcomingRenewals();
  const referralsAdvanced = await advanceOrderPlacedReferrals();
  const referralsExpired = await expireStaleReferrals();
  const referralRewards = await releaseMaturedReferralRewards();
  const loyaltyTiers = await recalculateLoyaltyTiers();
  const birthdayRewards = await awardBirthdayRewards();
  const pointsExpiry = await expirePoints();

  return NextResponse.json({
    ok: true,
    notified,
    stockCancelled,
    shipmentsCreated,
    renewalsNotified,
    referralsAdvanced,
    referralsExpired,
    referralRewards,
    loyaltyTiers,
    birthdayRewards,
    pointsExpiry,
  });
}

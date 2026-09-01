import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getVariantAvailability, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { cancelRecurringPlan, recurringMaintenanceConfigured } from "@/lib/2c2p";
import { expireStaleReferrals, releaseMaturedReferralRewards, advanceOrderPlacedReferrals } from "@/lib/referral-cron";
import { recalculateLoyaltyTiers } from "@/lib/loyalty-cron";
import { awardBirthdayRewards } from "@/lib/birthday-cron";
import { expirePoints } from "@/lib/points-expiry-cron";
import { expireStaleReservations } from "@/lib/stock-reservation";

const RENEWAL_NOTICE_DAYS = 3;

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

type RenewalDue = {
  id: string;
  user_id: string;
  product_name: string;
  plan_months: number;
  amount_per_cycle: number;
};

// 3 days' notice (RENEWAL_NOTICE_DAYS) before the next monthly charge
// fires. renewal_notified_at is cleared by the webhook on every successful
// charge, so this fires again ahead of every single cycle, not just once.
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
        title: "ใกล้ถึงรอบตัดเงินรายเดือนแล้ว",
        body: `${sub.product_name} จะตัดเงิน ${sub.amount_per_cycle.toLocaleString()} บาท สำหรับรอบเดือนถัดไป ภายใน ${RENEWAL_NOTICE_DAYS} วัน หากไม่ต้องการต่อ ยกเลิกได้ในหน้าการสมัครสมาชิก มีผลตั้งแต่รอบถัดไป`,
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
// (2C2P) monthly-billed subscriptions: the pre-charge stock check
// (cancelOutOfStockSubscriptions — 2C2P fires each month's charge on its
// own schedule, this is the only lever to stop one before it happens) and
// the pre-charge notice (notifyUpcomingRenewals) — there's no separate
// fulfillment job anymore, since every month's charge and shipment happen
// together in the 2C2P webhook itself, not split across a cron. Also the
// referral programme's daily housekeeping — advancing order_placed referrals whose
// order has since shipped (a poll fallback so this doesn't depend on the
// "orders/fulfilled" webhook topic ever being subscribed in Shopify),
// expiring stale click-throughs, and releasing matured rewards — see
// @/lib/referral-cron — plus the loyalty tier recalculation (rolling
// 12-month spend/orders, upgrade/downgrade with a 90-day grace period —
// see @/lib/loyalty-cron), the birthday bonus scan (see
// @/lib/birthday-cron), points expiry — 12 months per batch, FIFO
// (see @/lib/points-expiry-cron) — and the stock-reservation expiry sweep
// (see @/lib/stock-reservation), which frees inventory held by checkout
// attempts that were abandoned before ever reaching a payment outcome
// (releaseStock() never got called). All bundled into this one job since
// the Vercel Hobby plan caps cron jobs at 2 total and both slots are
// already spoken for.
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
  const renewalsNotified = await notifyUpcomingRenewals();
  const referralsAdvanced = await advanceOrderPlacedReferrals();
  const referralsExpired = await expireStaleReferrals();
  const referralRewards = await releaseMaturedReferralRewards();
  const loyaltyTiers = await recalculateLoyaltyTiers();
  const birthdayRewards = await awardBirthdayRewards();
  const pointsExpiry = await expirePoints();
  const reservationsExpired = await expireStaleReservations();

  return NextResponse.json({
    ok: true,
    notified,
    stockCancelled,
    renewalsNotified,
    referralsAdvanced,
    referralsExpired,
    referralRewards,
    loyaltyTiers,
    birthdayRewards,
    pointsExpiry,
    reservationsExpired,
  });
}

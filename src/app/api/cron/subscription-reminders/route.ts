import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getVariantAvailability, shopifyAdminConfigured } from "@/lib/shopify-admin";
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
  next_charge_date: string;
  product_name: string;
  product_slug: string;
  variant_id: string;
  recurring_unique_id: string | null;
  amount_per_cycle: number;
};

// Real subscriptions (2C2P recurring billing) whose next charge is coming up
// soon while the item is out of stock. This used to cancel the plan outright,
// which is no longer possible or wanted: a term never stops early (see
// ../../subscribe/[id]/cancel/route.ts), and the Recurring Payment
// Maintenance API that would stop one answers HTTP 401 on this account.
//
// So this now only *surfaces* the problem: the charge will fire and has to be
// refunded by hand in the 2C2P merchant portal (Card Transactions > REFUND).
// Detection is still worth doing — an out-of-stock cycle that nobody notices
// until the customer complains is far worse than a logged one.
// Best-effort: any row we can't confidently verify is left alone rather than
// guessed at.
async function flagOutOfStockSubscriptions() {
  if (!shopifyAdminConfigured()) return 0;

  const windowEnd = new Date(Date.now() + STOCK_CHECK_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const due = await supabaseRest<RealSubscriptionDue[]>(
    `real_subscriptions?status=eq.active&next_charge_date=lte.${windowEnd}&select=id,user_id,next_charge_date,product_name,product_slug,variant_id`
  );

  let flagged = 0;
  for (const sub of due) {
    const availability = await getVariantAvailability(sub.variant_id);
    if (!availability) continue; // couldn't verify — don't act on it

    const outOfStock =
      !availability.availableForSale ||
      (availability.inventoryPolicy === "DENY" && availability.inventoryQuantity !== null && availability.inventoryQuantity <= 0);
    if (!outOfStock) continue;

    // Deliberately does NOT touch `status` — 2C2P will still charge this
    // cycle, and claiming otherwise in our own data would be a lie.
    console.error(
      `[cron/subscription-reminders] subscription ${sub.id} (${sub.product_name}) charges on ${sub.next_charge_date} but the variant is out of stock — refund that cycle manually in the 2C2P portal if it cannot ship`
    );
    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: sub.user_id,
        type: "subscription_out_of_stock",
        title: "สินค้าในแพ็กสมาชิกหมดสต็อกชั่วคราว",
        body: `${sub.product_name} หมดสต็อกชั่วคราว ทีมงานกำลังตรวจสอบรอบจัดส่งถัดไปให้ และจะติดต่อกลับหากต้องเลื่อนส่งหรือคืนเงินรอบนี้`,
        link: `/product/${sub.product_slug}`,
        metadata: { subscriptionId: sub.id },
      }),
    });
    flagged++;
  }
  return flagged;
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
// (flagOutOfStockSubscriptions — surfaces a cycle that will charge for
// something unshippable, since a term is never stopped early) and
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

  const stockFlagged = await flagOutOfStockSubscriptions();
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
    stockFlagged,
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

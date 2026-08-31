import { supabaseRest } from "@/lib/supabase-server";
import { createAmountDiscountCode, getOrderFulfillmentStatus, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { REFERRAL_ANNUAL_CAP, REFERRAL_HOLD_DAYS, REFERRER_REWARD_AMOUNT } from "@/lib/referral-shared";
import { generateDiscountCode } from "@/lib/referral";

// Moves a referral from 'order_placed' to 'delivered' and starts the
// 14-day hold before the referrer's reward can release. Shared by the
// "orders/fulfilled" webhook (fast path, if that topic is ever subscribed
// in Shopify) and advanceOrderPlacedReferrals below (cron poll fallback —
// works even if it never is). The status=eq.order_placed filter makes this
// naturally idempotent against either path firing twice for the same order.
export async function markReferralDelivered(referredOrderId: string): Promise<{ referralId: string } | null> {
  const [row] = await supabaseRest<{ id: string }[]>(
    `referrals?referred_order_id=eq.${encodeURIComponent(referredOrderId)}&status=eq.order_placed&select=id&limit=1`
  );
  if (!row) return null;
  const deliveredAt = new Date();
  const releaseAt = new Date(deliveredAt.getTime() + REFERRAL_HOLD_DAYS * 86_400_000);
  await supabaseRest(`referrals?id=eq.${row.id}&status=eq.order_placed`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "delivered",
      delivered_at: deliveredAt.toISOString(),
      reward_release_at: releaseAt.toISOString(),
    }),
  });
  return { referralId: row.id };
}

// Cron-poll fallback for the delivery step: checks Shopify directly for
// every referral still sitting at 'order_placed', instead of relying solely
// on the "orders/fulfilled" webhook actually being subscribed (as of this
// writing it isn't — see the comment in the webhooks route). Keeps the
// whole referral programme working even if that subscription never gets
// set up, at the cost of a delivery detection lag of up to one cron cycle.
export async function advanceOrderPlacedReferrals(): Promise<number> {
  if (!shopifyAdminConfigured()) return 0;
  const pending = await supabaseRest<{ id: string; referred_order_id: string }[]>(
    `referrals?status=eq.order_placed&select=id,referred_order_id`
  );
  let advanced = 0;
  for (const row of pending) {
    const status = await getOrderFulfillmentStatus(row.referred_order_id);
    if (status?.fulfilled) {
      const result = await markReferralDelivered(row.referred_order_id);
      if (result) advanced++;
    }
  }
  return advanced;
}

// Referrals sitting in the "friend clicked but never ordered" state past
// their 30-day discount window are dead — mark them so they stop showing as
// active in the account UI and stop being matched by later lookups.
export async function expireStaleReferrals(): Promise<number> {
  const now = new Date().toISOString();
  const stale = await supabaseRest<{ id: string }[]>(
    `referrals?status=in.(pending,link_clicked)&discount_expires_at=lt.${now}&select=id`
  );
  if (stale.length === 0) return 0;
  await supabaseRest(`referrals?id=in.(${stale.map((r) => r.id).join(",")})`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "expired" }),
  });
  return stale.length;
}

// Referrals that have cleared the 14-day post-delivery hold with no refund
// in that window (refunds/create already voids on sight — see the webhook)
// get their reward released: a real, single-use ฿100 Shopify discount code
// for the referrer, capped at REFERRAL_ANNUAL_CAP successful referrals per
// referrer per rolling year. Over the cap still means the referral
// genuinely succeeded — it just doesn't get counted or paid, per the plan.
export async function releaseMaturedReferralRewards(): Promise<{ released: number; capped: number }> {
  if (!shopifyAdminConfigured()) return { released: 0, capped: 0 };
  const now = new Date().toISOString();
  const due = await supabaseRest<{ id: string; referrer_user_id: string }[]>(
    `referrals?status=eq.delivered&reward_release_at=lte.${now}&select=id,referrer_user_id`
  );

  let released = 0;
  let capped = 0;
  const capCache = new Map<string, number>();

  for (const row of due) {
    let releasedThisYear = capCache.get(row.referrer_user_id);
    if (releasedThisYear === undefined) {
      const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();
      const priorReleases = await supabaseRest<{ id: string }[]>(
        `referrals?referrer_user_id=eq.${row.referrer_user_id}&status=eq.reward_released&created_at=gte.${yearAgo}&select=id`
      );
      releasedThisYear = priorReleases.length;
      capCache.set(row.referrer_user_id, releasedThisYear);
    }

    if (releasedThisYear >= REFERRAL_ANNUAL_CAP) {
      await supabaseRest(`referrals?id=eq.${row.id}&status=eq.delivered`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ status: "void" }),
      });
      capped++;
      continue;
    }

    const discountCode = generateDiscountCode("SLREWARD");
    try {
      await createAmountDiscountCode({
        title: `Referral reward — ${row.id}`,
        code: discountCode,
        amount: REFERRER_REWARD_AMOUNT,
        usageLimit: 1,
      });
    } catch (err) {
      console.error("[referral-cron] failed to create reward discount code", row.id, err);
      continue; // leave it 'delivered' — retried on the next run
    }

    await supabaseRest(`referrals?id=eq.${row.id}&status=eq.delivered`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "reward_released", reward_shopify_discount_code: discountCode }),
    });
    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: row.referrer_user_id,
        type: "referral_reward",
        title: "ได้รับคูปองแนะนำเพื่อนแล้ว",
        body: `เพื่อนที่คุณแนะนำสั่งซื้อสำเร็จ รับคูปองส่วนลด ฿${REFERRER_REWARD_AMOUNT} โค้ด ${discountCode}`,
        link: "/account/referral",
        metadata: { referralId: row.id, discountCode },
      }),
    });
    capCache.set(row.referrer_user_id, releasedThisYear + 1);
    released++;
  }

  return { released, capped };
}

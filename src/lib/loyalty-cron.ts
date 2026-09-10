import { supabaseRest } from "@/lib/supabase-server";
import { getCustomerOrders, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { TierName, TIER_RANK, qualifiedTier } from "@/lib/loyalty-shared";

// Populates user_loyalty — a real "how much has this customer spent"
// record, independent of the redeemable points balance (which drains on
// redemption and expires per-batch). See scratchpad/loyalty-program-plan.md
// section 9.1. This is the write side; @/lib/user-tier is the read side
// every route/UI now uses instead of tierProgress(points) in @/data/coupons.

const ROLLING_WINDOW_DAYS = 365;
const DOWNGRADE_GRACE_DAYS = 90;
// Keeps each cron run bounded regardless of customer-base size — one
// Shopify Admin API round trip per candidate. last_reviewed_at ordering
// (oldest/never-reviewed first) means everyone still gets covered within a
// few days even past this cap, just not all in the same run.
const DAILY_BATCH_SIZE = 25;

type LoyaltyRow = {
  user_id: string;
  current_tier: TierName;
  tier_downgrade_grace_until: string | null;
  last_reviewed_at: string | null;
};

export async function recalculateLoyaltyTiers(): Promise<{
  reviewed: number;
  upgraded: number;
  downgraded: number;
  gracePeriodStarted: number;
}> {
  if (!shopifyAdminConfigured()) return { reviewed: 0, upgraded: 0, downgraded: 0, gracePeriodStarted: 0 };

  const [candidates, loyaltyRows] = await Promise.all([
    supabaseRest<{ id: string; shopify_customer_id: string }[]>(
      `users?shopify_customer_id=not.is.null&select=id,shopify_customer_id`
    ),
    supabaseRest<LoyaltyRow[]>(`user_loyalty?select=user_id,current_tier,tier_downgrade_grace_until,last_reviewed_at`),
  ]);

  const loyaltyByUser = new Map(loyaltyRows.map((r) => [r.user_id, r]));
  const batch = candidates
    .sort((a, b) => {
      const aReviewed = loyaltyByUser.get(a.id)?.last_reviewed_at;
      const bReviewed = loyaltyByUser.get(b.id)?.last_reviewed_at;
      if (!aReviewed && !bReviewed) return 0;
      if (!aReviewed) return -1;
      if (!bReviewed) return 1;
      return new Date(aReviewed).getTime() - new Date(bReviewed).getTime();
    })
    .slice(0, DAILY_BATCH_SIZE);

  let upgraded = 0;
  let downgraded = 0;
  let gracePeriodStarted = 0;

  for (const candidate of batch) {
    const orders = await getCustomerOrders(candidate.shopify_customer_id, 250);
    const cutoff = Date.now() - ROLLING_WINDOW_DAYS * 86_400_000;
    const recentPaid = (orders ?? []).filter(
      (o) => o.financialStatus === "PAID" && new Date(o.createdAt).getTime() >= cutoff
    );
    const spend = recentPaid.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const orderCount = recentPaid.length;

    const existing = loyaltyByUser.get(candidate.id);
    const currentTier: TierName = existing?.current_tier ?? "Bronze";
    const qualified = qualifiedTier(spend, orderCount);
    const now = new Date();

    let finalTier = currentTier;
    let graceUntil = existing?.tier_downgrade_grace_until ?? null;

    if (TIER_RANK[qualified] > TIER_RANK[currentTier]) {
      finalTier = qualified;
      graceUntil = null;
      upgraded++;
    } else if (TIER_RANK[qualified] < TIER_RANK[currentTier]) {
      if (graceUntil && new Date(graceUntil) <= now) {
        finalTier = qualified;
        graceUntil = null;
        downgraded++;
      } else if (!graceUntil) {
        graceUntil = new Date(now.getTime() + DOWNGRADE_GRACE_DAYS * 86_400_000).toISOString();
        gracePeriodStarted++;
      }
      // else: already in an unexpired grace period — leave as-is, keep waiting
    } else if (graceUntil) {
      // Back to qualifying at (or above) the current tier — clear a stale grace.
      graceUntil = null;
    }

    await supabaseRest("user_loyalty?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      returning: false,
      body: JSON.stringify({
        user_id: candidate.id,
        current_tier: finalTier,
        rolling_12mo_spend: spend,
        rolling_12mo_orders: orderCount,
        tier_downgrade_grace_until: graceUntil,
        last_reviewed_at: now.toISOString(),
        updated_at: now.toISOString(),
      }),
    });
  }

  return { reviewed: batch.length, upgraded, downgraded, gracePeriodStarted };
}

/**
 * One account's spend and tier, worked out now rather than by tomorrow's cron.
 *
 * The nightly pass covers 25 accounts at a time, so a customer who linked their
 * orders today saw "อีก ฿3,000 ถึง Silver" with an empty bar — their four
 * purchases were sitting in Shopify unread. This runs at the moment a link is
 * made, which is the moment the spend becomes knowable.
 *
 * Never throws: a failure here must not break the sign-in that triggered it.
 * Tomorrow's cron catches whatever this misses.
 */
export async function recalculateLoyaltyForUser(userId: string): Promise<UserLoyaltySnapshot | null> {
  if (!shopifyAdminConfigured()) return null;
  try {
    const [user] = await supabaseRest<{ id: string; shopify_customer_id: string | null }[]>(
      `users?id=eq.${userId}&select=id,shopify_customer_id&limit=1`
    );
    if (!user?.shopify_customer_id) return null;

    const orders = await getCustomerOrders(user.shopify_customer_id, 250);
    const cutoff = Date.now() - ROLLING_WINDOW_DAYS * 86_400_000;
    const recentPaid = (orders ?? []).filter(
      (o) => o.financialStatus === "PAID" && new Date(o.createdAt).getTime() >= cutoff
    );
    const spend = recentPaid.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const orderCount = recentPaid.length;

    const [existing] = await supabaseRest<LoyaltyRow[]>(
      `user_loyalty?user_id=eq.${userId}&select=user_id,current_tier,tier_downgrade_grace_until,last_reviewed_at`
    );
    const currentTier: TierName = existing?.current_tier ?? "Bronze";
    const qualified = qualifiedTier(spend, orderCount);
    // Upgrades apply at once; downgrades are left to the cron, which owns the
    // grace period. Nobody should lose a tier as a side effect of signing in.
    const finalTier = TIER_RANK[qualified] > TIER_RANK[currentTier] ? qualified : currentTier;

    await supabaseRest("user_loyalty?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      returning: false,
      body: JSON.stringify({
        user_id: userId,
        current_tier: finalTier,
        rolling_12mo_spend: spend,
        rolling_12mo_orders: orderCount,
        tier_downgrade_grace_until: existing?.tier_downgrade_grace_until ?? null,
        last_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    return { tier: finalTier, spend, orders: orderCount };
  } catch (err) {
    console.error("[loyalty] single-user recalculation failed", userId, err);
    return null;
  }
}

export type UserLoyaltySnapshot = { tier: TierName; spend: number; orders: number };

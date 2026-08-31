import { supabaseRest } from "@/lib/supabase-server";
import { TierName } from "@/lib/loyalty-shared";

export type UserLoyalty = { tier: TierName; spend: number; orders: number };

// Real tier basis: rolling 12-month spend/orders, maintained daily by
// recalculateLoyaltyTiers (@/lib/loyalty-cron) — not the redeemable points
// balance, which drains on redemption and would otherwise drop tier with
// it. Defaults to Bronze/0/0 when no row exists yet (brand-new signup
// before the next cron cycle, or no linked Shopify customer) — always a
// safe default since Bronze is the floor tier anyway.
export async function getUserLoyalty(userId: string): Promise<UserLoyalty> {
  const [row] = await supabaseRest<
    { current_tier: TierName; rolling_12mo_spend: number; rolling_12mo_orders: number }[]
  >(`user_loyalty?user_id=eq.${userId}&select=current_tier,rolling_12mo_spend,rolling_12mo_orders`);
  if (!row) return { tier: "Bronze", spend: 0, orders: 0 };
  return { tier: row.current_tier, spend: row.rolling_12mo_spend, orders: row.rolling_12mo_orders };
}

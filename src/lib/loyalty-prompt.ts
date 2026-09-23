import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { loyaltyTierProgress, type TierName } from "@/lib/loyalty-shared";
import { POINTS_PER_BAHT } from "@/data/coupons";

// What Smoothie is allowed to say about someone's points.
//
// "กี่แต้มแล้ว" is one of the most-asked questions in the chat and she used to
// answer it by sending people to go and look for themselves, because none of
// this was ever in front of her. It is all real: the balance is the same
// points_balance view /api/account/redeem trusts before letting anyone spend,
// and the tier is the one the daily cron maintains — so the number she says
// and the number on the account page cannot disagree.

// Matches POINTS_EXPIRY_DAYS in @/lib/points-expiry-cron (365 days per batch).
const POINTS_VALID_MONTHS = 12;

type RedemptionTier = {
  points_cost: number;
  discount_type: "percent" | "amount";
  discount_value: number;
  label_th: string;
};

function rewardLabel(tier: RedemptionTier) {
  return tier.label_th?.trim()
    ? tier.label_th
    : tier.discount_type === "percent"
      ? `ส่วนลด ${tier.discount_value}%`
      : `ส่วนลด ฿${tier.discount_value.toLocaleString("th-TH")}`;
}

/**
 * This customer's points and tier as prompt text, or null when there is
 * nothing trustworthy to say.
 *
 * Best-effort throughout: a failed lookup returns null, which the prompt reads
 * as "not available" and answers honestly, rather than leaving a half-filled
 * block the model might complete with a plausible-looking number.
 */
export async function loyaltySummaryForPrompt(userId: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  try {
    const uid = pgValue(userId);
    const [balanceRows, loyaltyRows, rewards] = await Promise.all([
      supabaseRest<{ balance: number }[]>(`points_balance?user_id=eq.${uid}&select=balance&limit=1`),
      supabaseRest<{ current_tier: TierName; rolling_12mo_spend: number; rolling_12mo_orders: number }[]>(
        `user_loyalty?user_id=eq.${uid}&select=current_tier,rolling_12mo_spend,rolling_12mo_orders&limit=1`
      ),
      supabaseRest<RedemptionTier[]>(
        "points_redemption_tiers?active=eq.true&order=points_cost.asc" +
          "&select=points_cost,discount_type,discount_value,label_th&limit=10"
      ).catch((): RedemptionTier[] => []),
    ]);

    const balance = balanceRows[0]?.balance ?? 0;
    // Bronze/0 is the floor, and the honest answer for an account the nightly
    // tier cron has not reached yet — not a missing value to hedge about.
    const spend = loyaltyRows[0]?.rolling_12mo_spend ?? 0;
    const orders = loyaltyRows[0]?.rolling_12mo_orders ?? 0;
    const tier = loyaltyRows[0]?.current_tier ?? "Bronze";
    const progress = loyaltyTierProgress(spend, orders);

    const lines = [
      `Points balance right now: ${balance.toLocaleString("th-TH")} แต้ม`,
      `Tier: ${tier} (rolling 12-month spend ฿${spend.toLocaleString("th-TH")}, ${orders} orders)`,
      progress.next
        ? `Next tier: ${progress.next} — another ฿${progress.remaining.toLocaleString("th-TH")} of spend within 12 months`
        : `Already at the top tier.`,
      `Earn rate: ฿1 spent = ${POINTS_PER_BAHT} แต้ม. Each batch of points expires ${POINTS_VALID_MONTHS} months after it was earned (oldest spent first).`,
    ];

    if (rewards.length) {
      lines.push("Rewards and whether they can afford them today:");
      for (const reward of rewards) {
        const short = reward.points_cost - balance;
        lines.push(
          `- ${reward.points_cost.toLocaleString("th-TH")} แต้ม → ${rewardLabel(reward)} — ${
            short <= 0 ? "แลกได้เลย" : `ขาดอีก ${short.toLocaleString("th-TH")} แต้ม`
          }`
        );
      }
    }

    return lines.join("\n");
  } catch (err) {
    console.error("[loyalty-prompt] lookup failed", err);
    return null;
  }
}

import { pointsForAmount } from "@/data/coupons";
import { getUserLoyalty } from "@/lib/user-tier";

// Every tier earns points at the same rate — the earn rate never varied by
// tier, only the perks do (see TIER_CRITERIA in @/lib/loyalty-shared). The
// tier tag on the return value is informational only (ledger metadata).
export async function pointsForOrder(subtotalAmount: number, userId: string) {
  const loyalty = await getUserLoyalty(userId);
  return { points: pointsForAmount(subtotalAmount), tier: loyalty.tier };
}

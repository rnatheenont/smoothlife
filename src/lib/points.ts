import { tierProgress } from "@/data/coupons";

// Gold members earn 1.5x points, matching the copy on /account/points.
export function tierMultiplier(tier: string) {
  return tier === "Gold" ? 1.5 : 1;
}

export function pointsForOrder(subtotalAmount: number, currentBalance: number) {
  const tier = tierProgress(currentBalance).current;
  const multiplier = tierMultiplier(tier);
  return { points: Math.floor((subtotalAmount * multiplier) / 100), multiplier, tier };
}

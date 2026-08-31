// Pure, DB-free tier logic — safe to import from both server code and
// "use client" components. The real (Supabase) lookup lives in
// @/lib/user-tier; the cron that populates it lives in @/lib/loyalty-cron.
// Both import TIER_CRITERIA/TIER_RANK from here so the numbers never drift.

export type TierName = "Bronze" | "Silver" | "Gold";

// Spend thresholds intentionally match TIERS in @/data/coupons.ts (Silver
// ฿3,000, Gold ฿10,000) even though the two are computed from different
// bases — see the note in @/lib/loyalty-cron. Order-count alternative per
// the plan's "เกณฑ์เข้า Tier ใช้ยอดใช้จ่าย หรือ จำนวนออเดอร์ อย่างใดอย่างหนึ่ง".
export const TIER_CRITERIA: { name: TierName; minSpend: number; minOrders: number }[] = [
  { name: "Bronze", minSpend: 0, minOrders: 0 },
  { name: "Silver", minSpend: 3000, minOrders: 10 },
  { name: "Gold", minSpend: 10000, minOrders: 20 },
];
export const TIER_RANK: Record<TierName, number> = { Bronze: 0, Silver: 1, Gold: 2 };

export function qualifiedTier(spend: number, orders: number): TierName {
  let best: TierName = "Bronze";
  for (const t of TIER_CRITERIA) {
    if (spend >= t.minSpend || orders >= t.minOrders) best = t.name;
  }
  return best;
}

// "Progress to next tier" for a progress-bar UI — spend-based only (the
// order-count alt path doesn't translate to a single percentage without
// picking one unit, and spend is the one customers actually see/track).
export function loyaltyTierProgress(spend: number, orders: number) {
  const current = TIER_CRITERIA.find((t) => t.name === qualifiedTier(spend, orders))!;
  const next = TIER_CRITERIA.find((t) => TIER_RANK[t.name] === TIER_RANK[current.name] + 1) ?? null;
  return {
    current: current.name,
    next: next ? next.name : null,
    remaining: next ? Math.max(0, next.minSpend - spend) : 0,
    percent: next
      ? Math.min(100, Math.round(((spend - current.minSpend) / (next.minSpend - current.minSpend)) * 100))
      : 100,
  };
}

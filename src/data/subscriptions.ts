import { products } from "./products";

export type SubscriptionPlan = {
  months: 3 | 6 | 9;
  code: string;
  discountPct: number;
  label: string;
  sublabel: string;
  popular?: boolean;
};

// Discount codes SUB3/SUB6/SUB9 are real Shopify discount codes (all
// products, all customers, no minimum) — applying one at checkout gives a
// genuine price reduction, not a cosmetic-only number on this page.
export const subscriptionPlans: SubscriptionPlan[] = [
  { months: 3, code: "SUB3", discountPct: 5, label: "ทุก 3 เดือน", sublabel: "เริ่มต้นลองดู" },
  { months: 6, code: "SUB6", discountPct: 10, label: "ทุก 6 เดือน", sublabel: "คุ้มค่าที่สุด", popular: true },
  { months: 9, code: "SUB9", discountPct: 15, label: "ทุก 9 เดือน", sublabel: "ประหยัดสูงสุด" },
];

// Curated for repeat-purchase categories (supplements/wellness, skincare
// staples). This catalogue sync carries no review/rating data (every
// product comes through as rating 0 / reviewCount 0), so products with a
// merchandising badge (Bestseller/New/Sale/Bundle) — i.e. ones the store
// itself is already promoting — are surfaced first, a real signal instead
// of a no-op sort on all-zero fields.
export const subscriptionProducts = products
  .filter((p) => p.inStock && (p.category === "wellness" || p.category === "skincare"))
  .sort((a, b) => (b.badges?.length ?? 0) - (a.badges?.length ?? 0))
  .slice(0, 12);

import { products } from "./products";

export type SubscriptionPlan = {
  months: 3 | 6 | 12;
  code: string;
  discountPct: number;
  label: string;
  sublabel: string;
  popular?: boolean;
};

// Discount codes SUB3/SUB6/SUB12 are real Shopify discount codes (all
// products, all customers, no minimum) — applying one at checkout gives a
// genuine price reduction, not a cosmetic-only number on this page.
export const subscriptionPlans: SubscriptionPlan[] = [
  { months: 3, code: "SUB3", discountPct: 5, label: "ทุก 3 เดือน", sublabel: "เริ่มต้นลองดู" },
  { months: 6, code: "SUB6", discountPct: 10, label: "ทุก 6 เดือน", sublabel: "คุ้มค่าที่สุด", popular: true },
  { months: 12, code: "SUB12", discountPct: 20, label: "ทุก 12 เดือน", sublabel: "ประหยัดสูงสุด" },
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

export type SubscriptionSet = {
  slug: string;
  name: string;
  tagline: string;
  // Real, in-stock product slugs from the live catalogue — a set is just a
  // fixed group of real SKUs, not a separate product of its own, so pricing
  // always reflects the actual current price of what's inside it.
  productSlugs: string[];
};

export const subscriptionSets: SubscriptionSet[] = [
  {
    slug: "hair-recovery",
    name: "ชุดฟื้นฟูเส้นผมและหนังศีรษะ",
    tagline: "แชมพู ครีมนวด เซรั่ม สูตรลดผมร่วง จาก Smooth E ใช้ครบเซ็ตทุกวัน",
    productSlugs: [
      "smooth-e-anti-hair-loss-hair-thickening-shampoo",
      "smooth-e-anti-hair-loss-hair-thickening-conditioner",
      "smooth-e-anti-hair-loss-hair-thickening-serum-spray",
    ],
  },
  {
    slug: "acne-clear",
    name: "ชุดเคลียร์สิวครบวงจร",
    tagline: "ทำความสะอาด แต้มสิว บำรุงรูขุมขน สูตร Acne-5 จาก Smooth E",
    productSlugs: [
      "smooth-e-acne-5-detox-moisture-extra-sensitive-cleansing-gel",
      "smooth-e-acne-5-rapid-action-plus",
      "smooth-e-acne-5-spot-pore-serum",
    ],
  },
  {
    slug: "oral-herbal",
    name: "ชุดดูแลช่องปากสมุนไพร",
    tagline: "ยาสีฟัน น้ำยาบ้วนปาก สเปรย์ปาก สูตรฟ้าทะลายโจร จาก Dentiste",
    productSlugs: [
      "dentiste-andrographis-paniculata-tube-40-g",
      "dentiste-andrographis-paniculata-plus-oral-rinse",
      "dentiste-andrographis-paniculata-mouth-spray",
    ],
  },
];

export function subscriptionSetProducts(set: SubscriptionSet) {
  return set.productSlugs.map((slug) => products.find((p) => p.slug === slug)).filter((p): p is (typeof products)[number] => !!p);
}

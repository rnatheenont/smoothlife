import { products } from "@/data/products";
import type { SubscriptionSet } from "@/data/subscriptions";

// The two parts of the subscription data that read the catalogue.
//
// They used to sit in data/subscriptions.ts next to the plans and the set
// definitions, which are plain configuration — and seven client components
// import those plans. One shared module meant all ~1,000 products in the
// bundle of the product page, the bundle builder, the subscription picker
// and the order summary, none of which asks the catalogue anything.

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

export function subscriptionSetProducts(set: SubscriptionSet) {
  return set.productSlugs.map((slug) => products.find((p) => p.slug === slug)).filter((p): p is (typeof products)[number] => !!p);
}

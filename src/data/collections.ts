import { ShopifyCollection } from "./types";
import { generatedCollections } from "./collections.generated";
import { products } from "./products";

// The real collections the marketing team maintains in Shopify — distinct from
// the hand-written `categories` in ./categories.ts, which are a fixed taxonomy
// the advisors and filters are built on. Collections change constantly
// (clearance-sale, buy-1-get-1-free-deal, brand pushes); categories don't.
export const collections: ShopifyCollection[] = generatedCollections;

export function getCollectionByHandle(handle: string) {
  return collections.find((c) => c.handle === handle);
}

export function getCollectionProducts(collection: ShopifyCollection) {
  // Preserve Shopify's own ordering — merchandisers sort collections
  // deliberately and alphabetising here would throw that away.
  return collection.productSlugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
}

import { Product } from "@/data/types";
import { products } from "@/data/products";

// The full spec calls for a verified "swap to [Pack 6], save exactly ฿640"
// banner — that requires a structured bundle-to-component SKU mapping
// (e.g. a metafield saying "this bundle = 2x that single item") which
// doesn't exist in this catalogue. Rather than fabricate a specific ฿
// savings figure we can't actually verify (a false-advertising risk on a
// real storefront), this surfaces same-brand Bundle/BOGO products already
// on sale as an honest "you might also like" cross-sell — every number
// shown is the product's own real advertised price/discount, nothing
// computed or assumed.
export function suggestBundlesForCart(cartSlugs: string[]): Product[] {
  if (cartSlugs.length === 0) return [];
  const cartSlugSet = new Set(cartSlugs);
  const brandsInCart = new Set(
    products.filter((p) => cartSlugSet.has(p.slug)).map((p) => p.brand)
  );
  if (brandsInCart.size === 0) return [];

  return products
    .filter(
      (p) =>
        brandsInCart.has(p.brand) &&
        !cartSlugSet.has(p.slug) &&
        p.inStock &&
        p.compareAtPrice &&
        (p.badges?.includes("Bundle") || p.badges?.includes("BOGO"))
    )
    .slice(0, 4);
}

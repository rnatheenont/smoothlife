import { Product } from "./types";
import { generatedProducts } from "./products.generated";

// The catalogue is pulled live from the Shopify storefront at
// smoothlife.com at build time (see scripts/fetch-products.js) and written
// to products.generated.ts. No hand-written/demo products are mixed in —
// every item on the site is a real Shopify product.
export const products: Product[] = generatedProducts;

export const isLiveCatalogue = generatedProducts.length > 0;

export function getProductBySlug(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(product: Product, limit = 4) {
  return products
    .filter(
      (p) =>
        p.inStock &&
        p.slug !== product.slug &&
        (p.category === product.category ||
          p.brand === product.brand ||
          p.concerns.some((c) => product.concerns.includes(c)))
    )
    .slice(0, limit);
}

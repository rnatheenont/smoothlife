import { Product } from "./types";
import { generatedProducts } from "./products.generated";

// The catalogue with everything in it — SERVER CODE AND /admin SCREENS ONLY.
//
// Descriptions, "about" paragraphs, benefits, how-to-use, ingredients,
// who-it's-for, SEO fields and the full photo gallery. About 3 MB. It exists
// for the few places that show or reason about that text: the product page,
// the chat assistant's product context and search, and the admin SEO and
// content tools.
//
// Never import this from a storefront "use client" module, or from anything
// one imports — it would put the whole file back in every visitor's browser
// bundle, which is the thing ./products was split off to stop. The admin
// screens that need SEO fields, SKUs or the gallery may import it: their
// chunks load only for staff. Everything else should use ./products.

export const productDetails: Product[] = generatedProducts;

const bySlug = new Map(productDetails.map((p) => [p.slug, p]));

export function getProductDetail(slug: string): Product | undefined {
  return bySlug.get(slug);
}

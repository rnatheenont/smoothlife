import { categories } from "@/data/categories";
import { products } from "@/data/products";
import type { Category } from "@/data/types";

// Its own file, away from data/categories.ts, because it is the one thing
// there that reads the catalogue — and that module is imported by the menu
// and the concern carousel, which are client components. One function with
// one import dragged ~650 KB of products into every page's bundle.
//
/**
 * The picture that stands for a category.
 *
 * A curated shot wins where one exists (three of the six have one in
 * /public/categories). The rest take the photo of the best-reviewed thing
 * currently in stock in that category — computed rather than pasted in, so
 * the tile cannot end up showing a product the shop stopped carrying, and so
 * it follows the catalogue when a product is reclassified.
 */
export function categoryImage(slug: Category): string {
  const declared = categories.find((c) => c.slug === slug)?.image;
  if (declared) return declared;
  const best = products
    .filter((p) => p.category === slug && p.inStock && p.image)
    .sort((a, b) => b.reviewCount - a.reviewCount)[0];
  return best?.image || "";
}

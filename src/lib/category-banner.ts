/**
 * The wide picture behind a category's banner.
 *
 * Drawn for this band rather than borrowed from the catalogue. The shop had
 * no banner art: three of the six categories carried a square packshot on a
 * grey studio background and the other three fell back to whichever product
 * happened to be first in stock, and neither survives being cropped to a
 * strip with a heading over it.
 *
 * These are built to the band's shape and to one rule — subject matter along
 * the left and right edges, the middle third left as empty pale gradient —
 * because the heading sits in that middle third. That is also why the set is
 * a closed list rather than a path built from any slug: a category with no
 * picture drawn for it gets the plain sky, which is a banner, instead of a
 * 404 behind its own name.
 *
 * Browser-safe and importing nothing: category-image.ts reads the catalogue,
 * and one import of that dragged ~650 KB of products into every bundle.
 */
const CATEGORY_BANNERS = [
  "skincare",
  "oral-care",
  "hair-care",
  "personal-care",
  "wellness",
  "body-care",
] as const;

/**
 * The two listing pages that are not one category.
 *
 * Drawn to the same rule as the six above — subject at the edges, the middle
 * third left empty — because the band draws them the same way. "All products"
 * is a little of everything the shop sells; "all brands" is a shelf of blank
 * containers, unbranded on purpose, since a directory of sixty brands cannot
 * put one of them on its own banner.
 */
export const ALL_PRODUCTS_BANNER = "/categories/banners/all-products.webp";
export const BRANDS_BANNER = "/categories/banners/brands.webp";

export function categoryBanner(slug: string | undefined): string | null {
  if (!slug) return null;
  if (!(CATEGORY_BANNERS as readonly string[]).includes(slug)) return null;
  return `/categories/banners/${slug}.webp`;
}

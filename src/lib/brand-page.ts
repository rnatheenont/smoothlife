import { cache } from "react";
import { isHouseBrand } from "@/data/brands";
import { brandFacts } from "@/lib/brand-seo";
import { groupBrandProducts, type GroupedProducts } from "@/lib/brand-groups";
import { withCustomImages } from "@/lib/product-images";
import { getBrandProfile, type BrandProfile } from "@/lib/brand-profiles";
import type { Brand, Product } from "@/data/types";

// Everything a brand page is drawn from, gathered once per request.
//
// A brand page is half a dozen sections that each need the same catalogue
// slice — the hero counts it, the tabs group it, the shelves show it, the
// list at the bottom links all of it. Each section's loader asks for it
// separately, because sections are independent and any of them can be moved
// or removed; `cache` is what stops that independence from costing six
// passes over the catalogue and six reads of the same profile row.

export type BrandPageData = {
  brand: Brand;
  isHouse: boolean;
  /** Overlaid with the team's own product pictures, sold-out last. */
  items: Product[];
  groups: GroupedProducts[];
  reviews: number;
  rating: number;
  minPrice: number;
  categoryNames: string[];
  profile: BrandProfile | null;
};

/**
 * `useDraft` is part of the cache key on purpose: the admin preview and the
 * live page can both be rendered in one process, and a request that asked
 * for the draft must never hand its answer to a request that did not.
 */
export const brandPageData = cache(async (slug: string, useDraft = false): Promise<BrandPageData | null> => {
  const facts = brandFacts(slug);
  if (!facts) return null;

  const [items, profile] = await Promise.all([withCustomImages(facts.items), getBrandProfile(slug, useDraft)]);
  return {
    brand: facts.brand,
    isHouse: isHouseBrand(facts.brand.slug),
    items,
    // Overlaid before grouping, so every card on the page comes from the
    // same list and a picture the team replaced is replaced everywhere.
    groups: groupBrandProducts(items),
    reviews: facts.reviews,
    rating: facts.rating,
    minPrice: facts.minPrice,
    categoryNames: facts.categoryNames,
    profile,
  };
});

/** Product grids on brand pages are 2 / 4 / 5 across (phone / tablet /
 *  desktop). Shelf lengths are counted in rows so the last row is always
 *  full — eight cards at five across left a row of three. */
export const BRAND_GRID = "grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5 xl:grid-cols-5";

/**
 * How many cards a shelf of `rows` desktop rows shows at each width.
 *
 * Every count is a whole number of rows at its own width: phones get two
 * phone-rows per desktop row (2 across), tablets one (4 across), desktops one
 * (5 across). The cards beyond a width's count are hidden with CSS rather
 * than left out, so the markup is the same for every visitor and the cache
 * holds one copy of the page.
 */
export function shelfCounts(rows: number) {
  return { base: rows * 4, md: rows * 4, xl: rows * 5 };
}

/** Classes for the card at `index` in a shelf of `rows` rows. */
export function shelfItemClass(index: number, rows: number): string {
  const { md, xl } = shelfCounts(rows);
  if (index >= xl) return "hidden";
  // base and md share a count, so one breakpoint is enough.
  if (index >= md) return "hidden xl:block";
  return "";
}

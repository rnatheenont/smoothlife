import type { Product } from "@/data/types";

// What a shop URL means, and the small answers that go with it.
//
// Split out of filter-products.ts, which does the filtering itself and
// therefore imports the catalogue. Every control on /shop — the filter
// sheet, the sort box, the chips — needs these types and this list and none
// of them needs the catalogue, but a single import of the module brought it
// along: ~650 KB in the browser to know what "sale" means.

export type ShopSearchParams = {
  category?: string;
  brand?: string;
  concern?: string;
  sort?: string;
  q?: string;
  minPrice?: string;
  maxPrice?: string;
  /** Comma-separated: sale, bogo, bundle, bestseller, new. */
  promo?: string;
  /** Minimum star rating, as shown on the cards (4 = "4 ดาวขึ้นไป"). */
  rating?: string;
  /** "list" switches the grid to one row per product. */
  view?: string;
  page?: string;
};

// Promotion filters, each defined by something already true of a product —
// no separate campaign list to keep in sync.
export const PROMO_FILTERS: { key: string; label: string; match: (p: Product) => boolean }[] = [
  { key: "sale", label: "สินค้าลดราคา", match: (p) => Boolean(p.compareAtPrice && p.compareAtPrice > p.price) },
  { key: "bogo", label: "ซื้อ 1 แถม 1", match: (p) => Boolean(p.badges?.includes("BOGO")) || /1\s*แถม\s*1|buy\s*1\s*get\s*1/i.test(p.name) },
  { key: "bundle", label: "เซ็ตสุดคุ้ม", match: (p) => Boolean(p.badges?.includes("Bundle")) },
  { key: "bestseller", label: "สินค้าขายดี", match: (p) => Boolean(p.badges?.includes("Bestseller")) || p.reviewCount >= 200 },
  { key: "new", label: "สินค้าใหม่", match: (p) => Boolean(p.badges?.includes("New")) },
];

/** How many of each facet the current filters leave — worked out on the
 *  server (filterCounts) and handed to the sheet. */
export type FilterCounts = {
  brand: Record<string, number>;
  concern: Record<string, number>;
  promo: Record<string, number>;
  /** Keyed by the minimum stars as a string, e.g. "4.5". */
  rating: Record<string, number>;
};

export const PAGE_SIZE = 24;

/** The star thresholds the filter offers, in the order it shows them. */
/** How the grid can be ordered. The labels are what the toolbar shows. */
export const SORTS: { value: string; label: string }[] = [
  { value: "", label: "แนะนำ" },
  { value: "bestseller", label: "ขายดี" },
  { value: "price-asc", label: "ราคาต่ำ–สูง" },
  { value: "price-desc", label: "ราคาสูง–ต่ำ" },
  { value: "rating", label: "คะแนนสูงสุด" },
];

export const RATING_STEPS = [4.5, 4, 3.5] as const;

export function multi(value: string | undefined): string[] {
  return (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

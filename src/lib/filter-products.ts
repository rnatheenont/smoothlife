import { products } from "@/data/products";
import { Product } from "@/data/types";
import { brands, brandSlugAliases, slugifyVendor } from "@/data/brands";

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

export const PAGE_SIZE = 24;

// Sold-out products are hidden from listings entirely rather than shown
// disabled — a customer browsing /shop, a category, a concern, or search
// results only wants things they can actually buy right now.
export function sortSoldOutLast(items: Product[]): Product[] {
  return items.filter((p) => p.inStock);
}

// The "แนะนำ" (recommended) default previously fell straight through to raw
// catalogue order, which is alphabetical by title (scripts/fetch-products.js
// queries sortKey: TITLE) — so every category opened on a monotonous wall of
// one brand's near-identical bottles in A-Z order. This re-ranks using only
// real fields already on every product (badges, compareAtPrice/price), then
// round-robins by brand so consecutive cards aren't all the same product line.
function toFeaturedOrder(items: Product[]): Product[] {
  const featuredScore = (p: Product) => {
    let score = 0;
    if (p.badges?.includes("New")) score += 2;
    if (p.badges?.includes("Sale") && p.compareAtPrice) {
      score += 1 + (p.compareAtPrice - p.price) / p.compareAtPrice;
    }
    return score;
  };

  const byScore = [...items].sort((a, b) => featuredScore(b) - featuredScore(a));

  const brandOrder: string[] = [];
  const byBrand = new Map<string, Product[]>();
  for (const p of byScore) {
    if (!byBrand.has(p.brand)) {
      byBrand.set(p.brand, []);
      brandOrder.push(p.brand);
    }
    byBrand.get(p.brand)!.push(p);
  }

  const result: Product[] = [];
  let remaining = byScore.length;
  while (remaining > 0) {
    for (const brand of brandOrder) {
      const group = byBrand.get(brand)!;
      const next = group.shift();
      if (next) {
        result.push(next);
        remaining--;
      }
    }
  }
  return result;
}

export function filterProducts(params: ShopSearchParams): Product[] {
  let result = [...products];

  if (params.category) {
    result = result.filter((p) => p.category === params.category);
  }
  if (params.brand) {
    const brand = brands.find((b) => b.slug === params.brand);
    const matchSlugs = brand ? brandSlugAliases(brand) : [params.brand];
    result = result.filter((p) => matchSlugs.includes(slugifyVendor(p.brand)));
  }
  if (params.concern) {
    result = result.filter((p) => p.concerns.includes(params.concern as Product["concerns"][number]));
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.shortDesc.toLowerCase().includes(q)
    );
  }
  if (params.minPrice) {
    result = result.filter((p) => p.price >= Number(params.minPrice));
  }
  if (params.maxPrice) {
    result = result.filter((p) => p.price <= Number(params.maxPrice));
  }
  if (params.promo) {
    // Several promo boxes ticked means "any of these", the way a shopper reads
    // a list of checkboxes — not "all at once", which would usually be empty.
    const wanted = params.promo.split(",").filter(Boolean);
    const matchers = PROMO_FILTERS.filter((f) => wanted.includes(f.key));
    if (matchers.length) result = result.filter((p) => matchers.some((m) => m.match(p)));
  }
  if (params.rating) {
    const min = Number(params.rating);
    if (Number.isFinite(min) && min > 0) result = result.filter((p) => p.reviewCount > 0 && p.rating >= min);
  }

  switch (params.sort) {
    case "price-asc":
      result.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      result.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      result.sort((a, b) => b.rating - a.rating);
      break;
    case "bestseller":
      result.sort((a, b) => (b.badges?.includes("Bestseller") ? 1 : 0) - (a.badges?.includes("Bestseller") ? 1 : 0));
      break;
    default:
      result = toFeaturedOrder(result);
      break;
  }

  return sortSoldOutLast(result);
}

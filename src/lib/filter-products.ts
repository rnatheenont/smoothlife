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
  page?: string;
};

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

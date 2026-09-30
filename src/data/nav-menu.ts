import { products } from "./products";
import { categories, concerns } from "./categories";
import { brands, brandSlugAliases, slugifyVendor } from "./brands";
import type { Category } from "./types";

// What the shop menu is made of.
//
// Konvy's menu — the reference — has a real two-level taxonomy behind it, and
// this catalogue has one level: six categories and nothing under them. Rather
// than invent subcategories nobody maintains, each category's second level is
// derived from what the products already say about themselves: the concerns
// they treat and the brands they come from. Both are real, both stay true when
// the catalogue is rebuilt, and neither needs anyone to remember to update a
// list by hand.

export type MenuGroup = {
  title: string;
  items: { label: string; href: string }[];
};

export type MenuCategory = {
  slug: Category;
  label: string;
  href: string;
  image: string;
  /** How many products sit under it — a category with none is not worth a row. */
  count: number;
  groups: MenuGroup[];
  brands: { slug: string; name: string; image?: string }[];
  /** One thing to look at. Two of the six categories carry no concern data at
   *  all, and their half of the panel was an empty rectangle without this. */
  featured: {
    slug: string;
    name: string;
    brand: string;
    image: string;
    price: number;
  } | null;
};

/** At most this many links under one heading: a column longer than this is a list, not a menu. */
const MAX_PER_GROUP = 6;
const MAX_BRANDS = 6;

function buildCategory(slug: Category): MenuCategory | null {
  const info = categories.find((c) => c.slug === slug);
  if (!info) return null;
  const inCategory = products.filter((p) => p.category === slug && p.inStock);
  if (inCategory.length === 0) return null;

  // Concerns ranked by how much of this category actually treats them, so a
  // skincare menu leads with acne rather than with whatever is alphabetically
  // first.
  const concernCount = new Map<string, number>();
  for (const p of inCategory)
    for (const c of p.concerns)
      concernCount.set(c, (concernCount.get(c) ?? 0) + 1);
  const topConcerns = concerns
    .filter((c) => concernCount.has(c.slug))
    .sort(
      (a, b) =>
        (concernCount.get(b.slug) ?? 0) - (concernCount.get(a.slug) ?? 0),
    )
    .slice(0, MAX_PER_GROUP);

  const brandCount = new Map<string, number>();
  for (const b of brands) {
    const aliases = brandSlugAliases(b);
    const n = inCategory.filter((p) =>
      aliases.includes(slugifyVendor(p.brand)),
    ).length;
    if (n > 0) brandCount.set(b.slug, n);
  }
  const topBrands = brands
    .filter((b) => brandCount.has(b.slug))
    .sort(
      (a, b) => (brandCount.get(b.slug) ?? 0) - (brandCount.get(a.slug) ?? 0),
    )
    .slice(0, MAX_BRANDS)
    .map((b) => ({ slug: b.slug, name: b.name, image: b.image }));

  const groups: MenuGroup[] = [
    {
      title: "เลือกตามปัญหา",
      items: topConcerns.map((c) => ({
        label: c.nameTh,
        href: `/concern/${c.slug}`,
      })),
    },
    {
      title: "ลัดไปเลย",
      items: [
        { label: `ทั้งหมดใน${info.nameTh}`, href: `/shop/${slug}` },
        { label: "ขายดี", href: `/shop/${slug}?sort=bestselling` },
        { label: "มาใหม่", href: `/shop/${slug}?sort=newest` },
        { label: "ลดราคา", href: `/shop/${slug}?sale=1` },
      ],
    },
  ].filter((g) => g.items.length > 0);

  const best = [...inCategory].sort(
    (a, b) => (b.sold ?? 0) - (a.sold ?? 0) || b.reviewCount - a.reviewCount,
  )[0];
  const featured = best
    ? {
        slug: best.slug,
        name: best.name,
        brand: best.brand,
        image: best.image,
        price: best.price,
      }
    : null;

  return {
    slug,
    label: info.nameTh,
    href: `/shop/${slug}`,
    image: info.image,
    count: inCategory.length,
    groups,
    brands: topBrands,
    featured,
  };
}

/** The shop menu, built once at module load from the generated catalogue. */
export const menuCategories: MenuCategory[] = categories
  .map((c) => buildCategory(c.slug))
  .filter((c): c is MenuCategory => c !== null);

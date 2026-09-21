import { brandProducts, getBrand } from "@/data/brands";
import { categories } from "@/data/categories";
import { sortSoldOutLast } from "@/lib/filter-products";
import { formatTHB } from "@/lib/format";

/**
 * What a brand hub page can say about itself, counted from the catalogue.
 *
 * Shared by the page and by the admin SEO screen so the "ค่าเริ่มต้น" shown
 * beside the edit box is the string the page would really render — an admin
 * comparing the two is comparing the same thing.
 */
export function brandFacts(slug: string) {
  const brand = getBrand(slug);
  if (!brand) return null;

  const all = brandProducts(brand);
  const items = sortSoldOutLast(all);
  const rated = all.filter((p) => p.reviewCount > 0);
  const reviews = rated.reduce((sum, p) => sum + p.reviewCount, 0);
  const rating = reviews > 0 ? rated.reduce((sum, p) => sum + p.rating * p.reviewCount, 0) / reviews : 0;
  const prices = items.map((p) => p.price).filter((n) => n > 0);
  const categoryNames = categories.filter((c) => items.some((p) => p.category === c.slug)).map((c) => c.nameTh);

  return {
    brand,
    items,
    reviews,
    rating,
    minPrice: prices.length ? Math.min(...prices) : 0,
    categoryNames,
  };
}

export type BrandFacts = NonNullable<ReturnType<typeof brandFacts>>;

export function brandSeoDefaults(facts: BrandFacts) {
  const { brand, items, reviews, minPrice } = facts;
  const description = [
    `ซื้อ ${brand.name} ของแท้ ${items.length} รายการ`,
    minPrice > 0 ? `เริ่มต้น ${formatTHB(minPrice)}` : "",
    reviews > 0 ? `รีวิวจริง ${reviews.toLocaleString("th-TH")} รายการ` : "",
    "ส่งฟรีทั่วไทย ที่ Smoothlife.com",
  ]
    .filter(Boolean)
    .join(" ");
  return { title: `${brand.name} ของแท้ ราคาดี | Smoothlife.com`, description };
}

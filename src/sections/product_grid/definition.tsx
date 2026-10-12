import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import SectionHeading from "@/components/SectionHeading";
import { products } from "@/data/products";
import { withCustomImages } from "@/lib/product-images";
import type { Product } from "@/data/types";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { toCardData } from "@/data/card";

// A shelf of products, chosen either by hand or by rule.
//
// Both ways earn their place. A hand-picked list is what a campaign wants —
// these six, in this order. A rule is what a page that must not go stale
// wants: "best reviewed in skincare" keeps being true after the catalogue
// changes, and nobody has to remember to come back and edit it.

const schema = z.object({
  title: z.string().max(80).default(""),
  subtitle: z.string().max(60).default(""),
  href: z.string().default(""),
  source: z.enum(["picked", "category", "brand"]).default("picked"),
  /** source: picked */
  productSlugs: z.array(z.string().min(1)).max(24).default([]),
  /** source: category | brand */
  key: z.string().default(""),
  sort: z.enum(["rating", "bestseller", "price-asc", "price-desc"]).default("rating"),
  limit: z.number().int().min(2).max(24).default(8),
});

function pick(settings: z.output<typeof schema>): Product[] {
  // Sold-out products are left out everywhere else on the site; a shelf that
  // shows them is a shelf of disappointments.
  const inStock = products.filter((p) => p.inStock);

  if (settings.source === "picked") {
    return settings.productSlugs
      .map((slug) => inStock.find((p) => p.slug === slug))
      .filter((p): p is Product => Boolean(p))
      .slice(0, settings.limit);
  }

  const pool =
    settings.source === "category"
      ? inStock.filter((p) => p.category === settings.key)
      : inStock.filter((p) => p.brand.toLowerCase() === settings.key.toLowerCase());

  const sorted = [...pool];
  switch (settings.sort) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "bestseller":
      sorted.sort((a, b) => b.reviewCount - a.reviewCount);
      break;
    default:
      // Rating alone puts a single five-star review above a hundred
      // four-and-a-half-star ones, which is not what "best" means here.
      sorted.sort((a, b) => b.rating * Math.log10(b.reviewCount + 10) - a.rating * Math.log10(a.reviewCount + 10));
      break;
  }
  return sorted.slice(0, settings.limit);
}

async function load(settings: z.output<typeof schema>) {
  return withCustomImages(pick(settings));
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Product[]>) {
  const items = data ?? [];
  // A shelf with nothing on it is not a shelf. This happens when a hand-
  // picked product sells out, and leaving the heading over a gap looks like
  // the page failed rather than the stock did.
  if (items.length === 0) return null;

  return (
    <section className="container-page py-6 md:py-10">
      {settings.title && (
        <SectionHeading title={settings.title} subtitle={settings.subtitle || undefined} href={settings.href || undefined} />
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
        {items.map((product) => (
          <ProductCard key={product.slug} product={toCardData(product)} />
        ))}
      </div>
    </section>
  );
}

export const productGrid: SectionDefinition<typeof schema> = {
  type: "product_grid",
  version: 1,
  label: "ชั้นสินค้า",
  description: "เลือกสินค้าเอง หรือให้ระบบเลือกตามหมวด/แบรนด์",
  category: "product",
  schema,
  defaults: {
    title: "สินค้าแนะนำ",
    subtitle: "",
    href: "",
    source: "category",
    productSlugs: [],
    key: "skincare",
    sort: "rating",
    limit: 8,
  },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    { key: "subtitle", type: "text", label: "หัวข้อย่อย" },
    { key: "href", type: "text", label: 'ลิงก์ "ดูทั้งหมด"' },
    {
      key: "source",
      type: "select",
      label: "เลือกสินค้าแบบไหน",
      options: [["picked", "เลือกเอง"], ["category", "ตามหมวดหมู่"], ["brand", "ตามแบรนด์"]],
    },
    { key: "productSlugs", type: "product_slugs", label: "สินค้าที่เลือกเอง", max: 24 },
    { key: "key", type: "text", label: "หมวดหมู่ / แบรนด์", help: "เช่น skincare หรือ Smooth E" },
    {
      key: "sort",
      type: "select",
      label: "เรียงอย่างไร (เฉพาะแบบตามหมวด/แบรนด์)",
      options: [
        ["rating", "คะแนนดีที่สุด"],
        ["bestseller", "รีวิวเยอะที่สุด"],
        ["price-asc", "ราคาต่ำ-สูง"],
        ["price-desc", "ราคาสูง-ต่ำ"],
      ],
    },
    { key: "limit", type: "number", label: "แสดงกี่ชิ้น", min: 2, max: 24 },
  ],
  enabledOn: ["home", "page", "campaign", "brand"],
  load,
  check: async (settings) => {
    const found = pick(settings).length;
    if (found === 0) {
      return [
        {
          level: "error",
          message:
            settings.source === "picked"
              ? "ชั้นสินค้านี้ยังไม่มีสินค้าที่ขายอยู่เลย"
              : `ไม่พบสินค้าที่ขายอยู่ใน "${settings.key}"`,
        },
      ];
    }
    if (found < settings.limit) {
      return [{ level: "warning", message: `ชั้นสินค้านี้ตั้งไว้ ${settings.limit} ชิ้น แต่มีของจริง ${found} ชิ้น` }];
    }
    return [];
  },
  Component,
};

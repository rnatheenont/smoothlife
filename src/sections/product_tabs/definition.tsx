import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import ProductTabs from "@/components/campaign/ProductTabs";
import { products } from "@/data/products";
import { withCustomImages } from "@/lib/product-images";
import type { Product } from "@/data/types";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Several shelves behind one row of tabs.
//
// A campaign sells across every category at once, and five separate shelves
// stacked up is a page nobody reaches the bottom of. The tabs are the
// Shopee-style answer: one heading, five sets of products, one screen.
//
// Every tab's products are fetched and rendered on the server — see
// ProductTabs for why they are all in the HTML rather than loaded on click.

const tab = z.object({
  label: z.string().min(1).max(24),
  source: z.enum(["picked", "category", "brand"]).default("category"),
  key: z.string().default(""),
  productSlugs: z.array(z.string().min(1)).max(24).default([]),
  limit: z.number().int().min(2).max(24).default(8),
});

const schema = z.object({
  title: z.string().max(80).default(""),
  tabs: z.array(tab).max(6).default([]),
});

type Settings = z.output<typeof schema>;
type Data = { label: string; items: Product[] }[];

function pick(t: z.output<typeof tab>): Product[] {
  const inStock = products.filter((p) => p.inStock);
  if (t.source === "picked") {
    return t.productSlugs
      .map((slug) => inStock.find((p) => p.slug === slug))
      .filter((p): p is Product => Boolean(p))
      .slice(0, t.limit);
  }
  const pool =
    t.source === "category"
      ? inStock.filter((p) => p.category === t.key)
      : inStock.filter((p) => p.brand.toLowerCase() === t.key.toLowerCase());
  // Same ranking as the ordinary shelf: rating alone would put one five-star
  // review above a hundred four-and-a-half-star ones.
  return [...pool]
    .sort((a, b) => b.rating * Math.log10(b.reviewCount + 10) - a.rating * Math.log10(a.reviewCount + 10))
    .slice(0, t.limit);
}

async function load(settings: Settings): Promise<Data> {
  const filled = await Promise.all(
    settings.tabs.map(async (t) => ({ label: t.label, items: await withCustomImages(pick(t)) }))
  );
  // A tab with nothing in it is worse than one fewer tab: it looks like the
  // page failed rather than like the stock ran out.
  return filled.filter((t) => t.items.length > 0);
}

function Component({ settings, data }: SectionProps<Settings, Data>) {
  const tabs = data ?? [];
  if (tabs.length === 0) return null;

  const panels = tabs.map((t) => (
    <div key={t.label} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
      {t.items.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  ));

  return (
    <section className="container-page py-6 md:py-10">
      {settings.title && (
        <h2 className="mb-3 text-base font-bold text-brand-ink md:text-lg">{settings.title}</h2>
      )}
      <ProductTabs labels={tabs.map((t) => t.label)} panels={panels} />
    </section>
  );
}

export const productTabs: SectionDefinition<typeof schema> = {
  type: "product_tabs",
  version: 1,
  label: "แท็บหมวดสินค้า",
  description: "หลายหมวดในที่เดียว · สินค้าทุกแท็บอยู่ในหน้าเลย ไม่ต้องโหลดใหม่",
  category: "product",
  schema,
  defaults: {
    title: "เลือกตามหมวด",
    tabs: [
      { label: "ผิวหน้า", source: "category", key: "skincare", productSlugs: [], limit: 8 },
      { label: "ช่องปาก", source: "category", key: "oral-care", productSlugs: [], limit: 8 },
    ],
  },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    {
      key: "tabs",
      type: "json",
      label: "แท็บ",
      help: 'แต่ละอัน: label, source (picked|category|brand), key, productSlugs, limit เช่น [{"label":"ผิวหน้า","source":"category","key":"skincare","limit":8}]',
    },
  ],
  enabledOn: ["campaign", "home", "page"],
  load,
  check: async (settings) => {
    const issues = [];
    if (settings.tabs.length === 0) {
      issues.push({ level: "error" as const, message: "แท็บหมวดสินค้ายังไม่มีแท็บเลย" });
    }
    const empty = settings.tabs.filter((t) => pick(t).length === 0).map((t) => t.label);
    if (empty.length) {
      issues.push({
        level: "error" as const,
        message: `แท็บ ${empty.join(", ")} ไม่มีสินค้าที่ขายอยู่เลย — จะไม่แสดงบนหน้าจริง`,
      });
    }
    const labels = settings.tabs.map((t) => t.label.trim());
    if (new Set(labels).size !== labels.length) {
      issues.push({ level: "error" as const, message: "มีชื่อแท็บซ้ำกัน" });
    }
    return issues;
  },
  Component,
};

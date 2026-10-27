import { z } from "zod";
import ShopHero from "@/components/shop/ShopHero";
import CategoryCircles from "@/components/shop/CategoryCircles";
import { categories } from "@/data/categories";
import { filterProducts } from "@/lib/filter-products";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The banner at the top of the shop.
//
// Locked, because what it says is half decided by the query string: browsing
// a category replaces the title with that category's own name and picks the
// mark drawn large on the right. The editable half is the words for "no
// category chosen" — which is the shop's own front door and worth being able
// to change for a season without a deploy.
//
// It draws outside the page container on purpose: the banner is full-bleed
// and carries its own padding.

const schema = z.object({
  eyebrow: z.string().max(40).default(""),
  title: z.string().max(80).default(""),
  subtitle: z.string().max(120).default(""),
});

function Component({ settings, ctx }: SectionProps<z.output<typeof schema>>) {
  const query = ctx.query ?? {};
  const slug = query.category;
  const active = slug ? categories.find((c) => c.slug === slug) : undefined;
  // Counted here as well as in the listing below. Two passes over an
  // in-memory array is cheaper than threading one number between two
  // sections a page document is free to reorder or drop.
  const count = filterProducts(query).length;
  return (
    <ShopHero
      eyebrow={settings.eyebrow || undefined}
      title={active ? active.nameTh : settings.title}
      subtitle={settings.subtitle}
      count={count}
    >
      <CategoryCircles current={query} />
    </ShopHero>
  );
}

export const shopHero: SectionDefinition<typeof schema> = {
  type: "shop_hero",
  version: 1,
  label: "แบนเนอร์หน้าช้อป",
  description: "แถบหัวของหน้าช้อป — ถ้าเลือกหมวดอยู่ หัวข้อจะเป็นชื่อหมวดนั้นแทน",
  category: "hero",
  schema,
  defaults: { eyebrow: "PRODUCTS", title: "สินค้าทั้งหมด", subtitle: "ดูแลตัวเองได้ง่าย ๆ ในทุกวัน" },
  fields: [
    { key: "eyebrow", type: "text", label: "คำนำ (ตัวเล็กบนสุด)" },
    { key: "title", type: "text", label: "หัวข้อ (ตอนไม่ได้เลือกหมวด)" },
    { key: "subtitle", type: "text", label: "คำโปรย" },
  ],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  isLcpCandidate: true,
  Component,
};

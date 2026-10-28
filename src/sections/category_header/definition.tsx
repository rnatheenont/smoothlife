import { z } from "zod";
import ShopHero from "@/components/shop/ShopHero";
import { categories } from "@/data/categories";
import { filterProducts, type ShopSearchParams } from "@/lib/filter-products";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The category's name, with how many things are in it right now.
//
// "Right now" is the point of counting it here: the number is counted after
// the filters the shopper has already applied, so ticking a brand changes it.
// A number typed into a heading would be the size of the category on the day
// somebody typed it.
//
// The same banner /shop wears, and not a smaller cousin of it. A category
// page is the shop with one filter already on, so arriving at ดูแลเส้นผม
// from ช้อป should not feel like arriving at a different site — same sky,
// same heading weight, same row of categories to leave by.

const schema = z.object({
  countSuffix: z.string().max(40).default(""),
  subtitle: z.string().max(200).default("ดูแลตัวเองได้ง่าย ๆ ในทุกวัน"),
});

type Data = { title: string; count: number; params: ShopSearchParams };

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string }; query?: Record<string, string | undefined> }
): Promise<Data | null> {
  const slug = ctx.entity?.slug;
  const c = categories.find((x) => x.slug === slug);
  if (!c) return null;
  const current = { ...(ctx.query ?? {}), category: c.slug } as ShopSearchParams;
  return { title: c.nameTh, count: filterProducts(current).length, params: current };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  // countSuffix stays in the schema and goes unread: the banner says
  // "N รายการ" itself, and a document that still carries the old setting
  // should keep validating rather than fail on a field nobody can see.
  return (
    <ShopHero title={data.title} subtitle={settings.subtitle} count={data.count}>
    </ShopHero>
  );
}

export const categoryHeader: SectionDefinition<typeof schema> = {
  type: "category_header",
  version: 1,
  label: "หัวหน้าหมวดสินค้า",
  description: "ชื่อหมวดและจำนวนสินค้าที่เหลือหลังกรอง",
  category: "hero",
  schema,
  defaults: { countSuffix: "รายการ" },
  fields: [
    { key: "countSuffix", type: "text", label: "ข้อความหลังจำนวน", help: 'ขึ้นเป็น "53 ..." — เว้นว่างคือไม่แสดงป้าย' },
  ],
  enabledOn: ["template"],
  requiresEntity: ["category"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};

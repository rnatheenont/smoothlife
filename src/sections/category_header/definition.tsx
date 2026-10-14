import { z } from "zod";
import { categories } from "@/data/categories";
import { filterProducts, type ShopSearchParams } from "@/lib/filter-products";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The category's name, with how many things are in it right now.
//
// "Right now" is the point of counting it here: the number is counted after
// the filters the shopper has already applied, so ticking a brand changes it.
// A number typed into a heading would be the size of the category on the day
// somebody typed it.

const schema = z.object({
  countSuffix: z.string().max(40).default(""),
});

type Data = { title: string; count: number };

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string }; query?: Record<string, string | undefined> }
): Promise<Data | null> {
  const slug = ctx.entity?.slug;
  const c = categories.find((x) => x.slug === slug);
  if (!c) return null;
  const current = { ...(ctx.query ?? {}), category: c.slug } as ShopSearchParams;
  return { title: c.nameTh, count: filterProducts(current).length };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  return (
    <section className="container-page">
      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-ink md:text-3xl">{data.title}</h1>
        {settings.countSuffix && (
          <span className="shrink-0 rounded-full bg-brand-gradient-soft px-3 py-1 text-xs font-medium text-brand-800 md:text-sm">
            {data.count} {settings.countSuffix}
          </span>
        )}
      </div>
    </section>
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

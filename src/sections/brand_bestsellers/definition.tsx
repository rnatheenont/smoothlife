import { z } from "zod";
import { Star } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { BRAND_GRID, brandPageData } from "@/lib/brand-page";
import type { Product } from "@/data/types";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The shelf at the top of a brand's catalogue.
//
// Two sources, in this order:
//   1. The products the team chose on the brand's profile, in their order.
//      This is what a brand page in a campaign, or a house brand with a hero
//      product, actually wants first.
//   2. Otherwise, the most-reviewed — the only popularity signal in the
//      catalogue that is real (`sold` is 0 for every item). Skipped for a
//      small brand, where "most reviewed" is the same few products the
//      shopper is about to scroll past anyway.

const schema = z.object({
  title: z.string().max(80).default(""),
  limit: z.number().int().min(2).max(10).default(4),
});

/** Below this many products a brand's whole range fits on screen, and a
 *  "most reviewed" shelf would only repeat it. */
const SMALL_BRAND = 8;

type Data = { brandName: string; items: Product[]; curated: boolean };

async function load(settings: z.output<typeof schema>, ctx: { slug: string }): Promise<Data | null> {
  const page = await brandPageData(ctx.slug);
  if (!page) return null;

  const featured = page.profile?.featured_slugs ?? [];
  if (featured.length > 0) {
    // In stock only: a chosen product that sold out is the one shelf on the
    // page that would otherwise lead with a dead end.
    const bySlug = new Map(page.items.map((p) => [p.slug, p]));
    const items = featured
      .map((slug) => bySlug.get(slug))
      .filter((p): p is Product => Boolean(p && p.inStock))
      .slice(0, settings.limit);
    if (items.length > 0) return { brandName: page.brand.name, items, curated: true };
  }

  if (page.items.length <= SMALL_BRAND) return { brandName: page.brand.name, items: [], curated: false };
  const items = [...page.items].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, settings.limit);
  return { brandName: page.brand.name, items, curated: false };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data || data.items.length === 0) return null;
  const heading = settings.title.trim();

  return (
    <section className="container-page mt-8">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-brand-ink md:text-xl">
        <Star size={18} className="fill-amber-400 text-amber-400" aria-hidden="true" />
        {heading ? (
          heading
        ) : data.curated ? (
          <>
            สินค้าแนะนำจาก<span translate="no">{data.brandName}</span>
          </>
        ) : (
          <>
            สินค้า<span translate="no">{data.brandName}</span>ที่มีคนรีวิวมากที่สุด
          </>
        )}
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        {data.curated ? "คัดมาโดยทีม Smoothlife" : "เรียงจากจำนวนรีวิวจริงของผู้ซื้อบนเว็บไซต์"}
      </p>
      <div className={BRAND_GRID}>
        {data.items.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}

export const brandBestsellers: SectionDefinition<typeof schema> = {
  type: "brand_bestsellers",
  version: 1,
  label: "สินค้าแนะนำ / ขายดีของแบรนด์",
  description: "สินค้าที่เลือกไว้ในโปรไฟล์แบรนด์ ถ้าไม่ได้เลือกจะใช้สินค้ารีวิวเยอะที่สุด",
  category: "brand",
  schema,
  defaults: { title: "", limit: 4 },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ", help: "เว้นว่าง = ใช้หัวข้ออัตโนมัติตามชื่อแบรนด์" },
    { key: "limit", type: "number", label: "แสดงกี่ชิ้น", min: 2, max: 10, help: "แนะนำ 4, 5 หรือ 10 ให้แถวเต็มบนจอคอม" },
  ],
  enabledOn: ["brand"],
  maxPerPage: 1,
  load,
  Component,
};

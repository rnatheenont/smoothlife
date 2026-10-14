import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";
import type { Concern } from "@/data/types";
import { toCardData, type ProductCardData } from "@/data/card";
import { sortSoldOutLast } from "@/lib/filter-products";
import { withCustomImages } from "@/lib/product-images";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The products for the concern this page is about.
//
// Sold-out last, which is a rule about the catalogue rather than this page:
// a grid that opens with four things nobody can buy reads as a shop that has
// run out. The count in the heading is counted here for the same reason it is
// counted in the collection tiles — a number typed into a heading is a number
// frozen on the day somebody typed it.

const schema = z.object({
  heading: z.string().max(120).default(""),
  emptyText: z.string().max(200).default(""),
});

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string } }
): Promise<ProductCardData[]> {
  const slug = ctx.entity?.slug;
  if (!slug) return [];
  // The cast is the one honest line here: a concern's slug is a Concern by
  // construction (the entity came from the same list), but the route hands it
  // over as the string it took out of the URL.
  const items = await withCustomImages(
    sortSoldOutLast(products.filter((p) => p.concerns.includes(slug as Concern)))
  );
  return items.map(toCardData);
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, ProductCardData[]>) {
  const items = data ?? [];

  return (
    <section className="container-page pb-8 md:pb-10">
      {settings.heading && (
        <h2 className="mb-4 font-bold text-brand-ink">
          {settings.heading} ({items.length})
        </h2>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{settings.emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

export const concernProducts: SectionDefinition<typeof schema> = {
  type: "concern_products",
  version: 1,
  label: "สินค้าของปัญหาผิวนี้",
  description: "ตารางสินค้าที่ตรงกับปัญหาผิวที่หน้านี้แสดง สินค้าหมดอยู่ท้ายสุด",
  category: "product",
  schema,
  defaults: { heading: "สินค้าแนะนำ", emptyText: "เร็วๆ นี้จะมีสินค้าเพิ่มเติมสำหรับหมวดนี้" },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ", help: "จำนวนสินค้าจะต่อท้ายให้เองในวงเล็บ" },
    { key: "emptyText", type: "text", label: "ข้อความเมื่อยังไม่มีสินค้า" },
  ],
  enabledOn: ["template"],
  requiresEntity: ["concern"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};

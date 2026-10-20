import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import SectionHeading from "@/components/SectionHeading";
import { getRelatedProducts } from "@/data/products";
import { getProductDetail } from "@/data/product-details";
import { toCardData, type ProductCardData } from "@/data/card";
import { withCustomImages } from "@/lib/product-images";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Five products like this one.
//
// Not locked, and that is the point of the product template existing at all:
// §G7 of the plan asks for exactly this — the buying part fixed, the blocks
// around it movable. Somebody who decides that recently-viewed should come
// first, or that this shelf does not belong on a page at all, can say so.
//
// The heading is two lines because SectionHeading is: a Thai title and an
// English line under it, which is how every shelf on this site is labelled.

const schema = z.object({
  title: z.string().max(120).default(""),
  subtitle: z.string().max(120).default(""),
  count: z.number().int().min(2).max(8).default(5),
});

async function load(
  settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string } }
): Promise<ProductCardData[]> {
  const slug = ctx.entity?.slug;
  const found = slug ? getProductDetail(slug) : undefined;
  if (!found) return [];
  const items = await withCustomImages(getRelatedProducts(found, settings.count));
  return items.map(toCardData);
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, ProductCardData[]>) {
  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <section className="container-page">
      <div className="mt-16">
        <SectionHeading title={settings.title} subtitle={settings.subtitle} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-5">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

export const relatedProducts: SectionDefinition<typeof schema> = {
  type: "related_products",
  version: 1,
  label: "สินค้าที่เกี่ยวข้อง",
  description: "ตารางสินค้าที่ใกล้เคียงกับสินค้าที่หน้านี้แสดง",
  category: "product",
  schema,
  defaults: { title: "สินค้าที่เกี่ยวข้อง", subtitle: "You may also like", count: 5 },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    { key: "subtitle", type: "text", label: "บรรทัดรองใต้หัวข้อ" },
    { key: "count", type: "number", label: "จำนวนสินค้า", min: 2, max: 8 },
  ],
  enabledOn: ["template"],
  requiresEntity: ["product"],
  maxPerPage: 1,
  load,
  Component,
};

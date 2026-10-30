import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import { toCardData, type ProductCardData } from "@/data/card";
import { getPublicQuestion, taggedProducts } from "@/lib/kb-public";
import { withCustomImages } from "@/lib/product-images";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The products this answer is about.
//
// Which products those are comes from the tags whoever wrote the answer put
// on it, so there is nothing to pick here — only how many to show and what to
// call the shelf.

const schema = z.object({
  heading: z.string().max(120).default(""),
  count: z.number().int().min(2).max(8).default(4),
});

async function load(
  settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string } }
): Promise<ProductCardData[]> {
  const slug = ctx.entity?.slug;
  const q = slug ? await getPublicQuestion(slug) : null;
  if (!q) return [];
  const items = await withCustomImages(taggedProducts(q.product_tags));
  return items.slice(0, settings.count).map(toCardData);
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, ProductCardData[]>) {
  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <section className="container-page">
      <div className="mt-12">
        {settings.heading && (
          <h2 className="mb-4 text-lg font-bold text-brand-ink md:text-xl">{settings.heading}</h2>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

export const questionProducts: SectionDefinition<typeof schema> = {
  type: "question_products",
  version: 1,
  label: "สินค้าที่เกี่ยวข้องกับคำตอบ",
  description: "ตารางสินค้าตามแท็กที่ติดไว้กับคำตอบนี้",
  category: "product",
  schema,
  defaults: { heading: "สินค้าที่เกี่ยวข้อง", count: 4 },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    { key: "count", type: "number", label: "จำนวนสินค้า", min: 2, max: 8 },
  ],
  enabledOn: ["template"],
  requiresEntity: ["question"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};

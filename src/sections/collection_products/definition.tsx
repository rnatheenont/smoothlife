import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import { getCollectionByHandle, getCollectionProducts } from "@/data/collections";
import { toCardData, type ProductCardData } from "@/data/card";
import { withCustomImages } from "@/lib/product-images";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// What is in the collection, in the order the merchandisers put it in.
//
// Shopify's own ordering is kept — see getCollectionProducts — because a
// merchandiser sorting a collection is making a decision, and alphabetising
// it here would throw that decision away.

const schema = z.object({});

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; handle?: string } }
): Promise<ProductCardData[]> {
  const handle = ctx.entity?.handle;
  const c = handle ? getCollectionByHandle(handle) : undefined;
  if (!c) return [];
  const items = await withCustomImages(getCollectionProducts(c));
  return items.map(toCardData);
}

function Component({ data }: SectionProps<z.output<typeof schema>, ProductCardData[]>) {
  const items = data ?? [];

  return (
    <section className="container-page pb-6 md:pb-8">
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
        {items.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}

export const collectionProducts: SectionDefinition<typeof schema> = {
  type: "collection_products",
  version: 1,
  label: "สินค้าในคอลเลกชัน",
  description: "ตารางสินค้าของคอลเลกชันที่หน้านี้แสดง เรียงตามลำดับที่ตั้งไว้ใน Shopify",
  category: "product",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["template"],
  requiresEntity: ["collection"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};

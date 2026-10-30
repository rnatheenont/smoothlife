import { z } from "zod";
import { getCollectionByHandle, getCollectionProducts } from "@/data/collections";
import ShopHero from "@/components/shop/ShopHero";
import { collectionBanner } from "@/lib/category-banner";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// A collection's own introduction: its name, how many things are in it, and
// whatever the marketing team wrote about it in Shopify.
//
// No artwork. The thumbnail beside the title came from the collection's own
// Shopify image, and those are stock photographs of the category rather than
// of anything for sale — a hand holding a thermometer over a grid of cotton
// pads. It said nothing the heading did not and pushed the first row of
// products down the screen.
//
// Everything on it comes from the collection, so there is one setting, and it
// is the one editorial question: whether to print the Shopify description at
// all. Those descriptions are written for the Shopify storefront and some of
// them are a sentence of keywords.

const schema = z.object({
  showDescription: z.boolean().default(true),
  countSuffix: z.string().max(60).default(""),
});

type Data = { title: string; handle: string; count: number; description: string };

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; handle?: string } }
): Promise<Data | null> {
  const handle = ctx.entity?.handle;
  const c = handle ? getCollectionByHandle(handle) : undefined;
  if (!c) return null;
  return {
    title: c.title,
    // The products that really resolve, not the length of the slug list: a
    // collection can name a product the catalogue no longer has, and the
    // count under the title should agree with the grid under it.
    count: getCollectionProducts(c).length,
    handle: c.handle,
    description: c.description ?? "",
  };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  // The same band /shop and the category pages wear. This section used to
  // draw a plain h1 in the container, which is what the hand-written route
  // did before it was moved onto ShopHero — and since the route renders from
  // the document, the band only arrives when it is put here.
  return (
    <ShopHero
      eyebrow="COLLECTION"
      title={data.title}
      subtitle={settings.showDescription ? data.description : ""}
      count={settings.countSuffix ? data.count : undefined}
      countLabel={settings.countSuffix || undefined}
      banner={collectionBanner(data.handle)}
    />
  );
}

export const collectionHeader: SectionDefinition<typeof schema> = {
  type: "collection_header",
  version: 1,
  label: "หัวหน้าคอลเลกชัน",
  description: "ชื่อ จำนวนสินค้า และคำบรรยายของคอลเลกชันที่หน้านี้แสดง",
  category: "hero",
  schema,
  defaults: { showDescription: true, countSuffix: "รายการ" },
  fields: [
    { key: "countSuffix", type: "text", label: "ข้อความหลังจำนวน", help: 'ขึ้นเป็น "12 ..." — เว้นว่างคือไม่แสดง' },
    { key: "showDescription", type: "toggle", label: "แสดงคำบรรยายจาก Shopify" },
  ],
  enabledOn: ["template"],
  requiresEntity: ["collection"],
  locked: true,
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  Component,
};

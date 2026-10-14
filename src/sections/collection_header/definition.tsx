import Image from "next/image";
import { z } from "zod";
import { getCollectionByHandle, getCollectionProducts } from "@/data/collections";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// A collection's own introduction: its artwork, its name, how many things are
// in it, and whatever the marketing team wrote about it in Shopify.
//
// Everything on it comes from the collection, so there is one setting, and it
// is the one editorial question: whether to print the Shopify description at
// all. Those descriptions are written for the Shopify storefront and some of
// them are a sentence of keywords.

const schema = z.object({
  showDescription: z.boolean().default(true),
  countSuffix: z.string().max(60).default(""),
});

type Data = { title: string; image: string | null; count: number; description: string };

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; handle?: string } }
): Promise<Data | null> {
  const handle = ctx.entity?.handle;
  const c = handle ? getCollectionByHandle(handle) : undefined;
  if (!c) return null;
  return {
    title: c.title,
    image: c.image,
    // The products that really resolve, not the length of the slug list: a
    // collection can name a product the catalogue no longer has, and the
    // count under the title should agree with the grid under it.
    count: getCollectionProducts(c).length,
    description: c.description ?? "",
  };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  return (
    <section className="container-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        {data.image && (
          <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl2 md:h-24 md:w-40">
            <Image src={data.image} alt={data.title} fill className="object-cover" sizes="160px" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-brand-ink md:text-3xl">{data.title}</h1>
          {settings.countSuffix && (
            <p className="mt-1 text-sm text-slate-500">
              {data.count} {settings.countSuffix}
            </p>
          )}
          {settings.showDescription && data.description && (
            <p className="mt-2 max-w-2xl text-sm text-slate-500">{data.description}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export const collectionHeader: SectionDefinition<typeof schema> = {
  type: "collection_header",
  version: 1,
  label: "หัวหน้าคอลเลกชัน",
  description: "รูป ชื่อ จำนวนสินค้า และคำบรรยายของคอลเลกชันที่หน้านี้แสดง",
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

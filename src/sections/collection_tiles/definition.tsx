import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { collections } from "@/data/collections";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Every collection the shop keeps in Shopify, biggest first.
//
// Biggest first rather than newest or alphabetical: the merchandising ones
// worth browsing (bundles, clearance, brand pushes) carry far more products
// than the long tail of one-off campaign groups, so sorting by size puts the
// useful ones on the first screen without anybody having to curate a list
// that would then go stale.
//
// Locked, and the count line lives here rather than in the header above,
// because the number is counted at render time from the catalogue. A header
// whose summary said "72 คอลเลกชัน" would be a number frozen on the day an
// admin typed it.

const schema = z.object({
  countSuffix: z.string().max(120).default(""),
  emptyText: z.string().max(200).default(""),
});

type Tile = { handle: string; title: string; image: string | null; count: number };

async function load(): Promise<Tile[]> {
  return [...collections]
    .sort((a, b) => b.productSlugs.length - a.productSlugs.length)
    .map((c) => ({ handle: c.handle, title: c.title, image: c.image, count: c.productSlugs.length }));
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Tile[]>) {
  const tiles = data ?? [];

  return (
    <section className="container-page pb-6 md:pb-8">
      {settings.countSuffix && (
        <p className="text-sm text-slate-500">
          {tiles.length} {settings.countSuffix}
        </p>
      )}
      {tiles.length === 0 ? (
        // mt-2 on top of the header's own 24px, which is the 32px the
        // hand-written page left above this line.
        <p className="mt-2 text-sm text-slate-500">{settings.emptyText}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {tiles.map((c) => (
            <Link
              key={c.handle}
              href={`/collections/${c.handle}`}
              className="group overflow-hidden rounded-xl2 shadow-card transition-shadow hover:shadow-cardHover"
            >
              <div className="relative aspect-4/3 bg-surface-soft">
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    className="object-cover transition-transform"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  // A collection with no artwork gets its initial rather than
                  // an empty grey box, so the grid stays a grid of things.
                  <div className="grid h-full place-items-center bg-brand-gradient-soft text-2xl font-bold text-brand-800/40">
                    {c.title.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-semibold text-brand-ink">{c.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{c.count} รายการ</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export const collectionTiles: SectionDefinition<typeof schema> = {
  type: "collection_tiles",
  version: 1,
  label: "ตารางคอลเลกชัน",
  description: "การ์ดคอลเลกชันทั้งหมดจากร้าน เรียงจากคอลเลกชันที่มีสินค้ามากที่สุด",
  category: "product",
  schema,
  defaults: {
    countSuffix: "คอลเลกชัน อัปเดตตรงจากร้าน",
    emptyText: "ยังไม่มีคอลเลกชันในขณะนี้",
  },
  fields: [
    { key: "countSuffix", type: "text", label: "ข้อความหลังจำนวน", help: 'ขึ้นเป็น "72 ..." — เว้นว่างคือไม่แสดงบรรทัดนี้' },
    { key: "emptyText", type: "text", label: "ข้อความเมื่อยังไม่มีคอลเลกชัน" },
  ],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};

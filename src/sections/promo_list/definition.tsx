import Image from "next/image";
import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";
import { withCustomImages } from "@/lib/product-images";
import { toCardData } from "@/data/card";
import type { Product } from "@/data/types";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The promotions page: a banner for each campaign with the things it applies
// to underneath.
//
// It replaces src/data/promotions.ts, which was four promotions that needed a
// deploy to change — on a page whose whole subject is what is on offer this
// month. The shelf under each banner keeps the rule the page already used:
// the products carrying that promotion's badge, and if the badge is on
// nothing yet, a slice of the catalogue so the row is never empty while
// somebody is still tagging products.
//
// Banners are pictures shot for this slot, not packshots — see the note the
// data file carried: a packshot on white needs a near-opaque scrim before the
// caption can be read on it, and four of those is not a promotions row.

const promo = z.object({
  slug: z.string().default(""),
  badge: z.string().max(24).default(""),
  title: z.string().max(80).default(""),
  subtitle: z.string().max(160).default(""),
  image: z.string().default(""),
});

const schema = z.object({
  items: z.array(promo).max(12).default([]),
  /** How many products sit under each banner. */
  perPromo: z.number().int().min(2).max(8).default(4),
});

type Shelf = { slug: string; display: Product[] };

async function load(settings: z.output<typeof schema>): Promise<Shelf[]> {
  // Resolved up front rather than inside the render, and all of them at once:
  // one pass over the catalogue for the page instead of one per banner.
  return Promise.all(
    settings.items.map(async (item, i) => {
      const tagged = products.filter((p) => p.badges?.some((b) => b === item.badge)).slice(0, settings.perPromo);
      const fallback = products.slice(i * settings.perPromo, (i + 1) * settings.perPromo);
      return { slug: item.slug, display: await withCustomImages(tagged.length > 0 ? tagged : fallback) };
    })
  );
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Shelf[]>) {
  const items = settings.items.filter((i) => i.title && i.image);
  if (items.length === 0) return null;
  const shelves = new Map((data ?? []).map((s) => [s.slug, s.display]));

  // The page's own bottom padding lives on the last section, the same
  // arrangement page_header has at the top.
  return (
    <section className="container-page pb-8 md:pb-10">
      {items.map((item, i) => (
        // The id is what the links from elsewhere on the site point at, and
        // scroll-mt keeps the banner clear of the sticky header when one does.
        <div key={item.slug || i} id={item.slug} className="mb-14 scroll-mt-24">
          <div className="relative mb-5 h-40 overflow-hidden rounded-xl2 md:h-56">
            <Image src={item.image} alt={item.title} fill className="object-cover object-[50%_35%]" />
            {/* Tinted to the banners' own teal. */}
            <div className="absolute inset-0 bg-linear-to-r from-[#0d3436]/80 via-[#0d3436]/45 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center p-6 text-white md:p-10">
              {item.badge && (
                <span className="w-fit rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold backdrop-blur-sm">
                  {item.badge}
                </span>
              )}
              <h2 className="mt-2 text-xl font-bold md:text-3xl">{item.title}</h2>
              {item.subtitle && <p className="text-sm text-white/80">{item.subtitle}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {(shelves.get(item.slug) ?? []).map((p) => (
              <ProductCard key={p.slug} product={toCardData(p)} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export const promoList: SectionDefinition<typeof schema> = {
  type: "promo_list",
  version: 1,
  label: "รายการโปรโมชั่น",
  description: "แบนเนอร์โปรโมชั่นพร้อมชั้นสินค้าที่เข้าโปรใต้แบนเนอร์",
  category: "promo",
  schema,
  defaults: {
    perPromo: 4,
    items: [
      {
        slug: "buy-1-get-1-free-deal",
        badge: "BOGO",
        title: "Buy 1 Get 1 Free",
        subtitle: "ซื้อ 1 แถม 1 เฉพาะสินค้าคัดสรร",
        image: "/promotions/buy-1-get-1-free-deal.jpg",
      },
    ],
  },
  fields: [
    {
      key: "items",
      type: "list",
      label: "โปรโมชั่น",
      item: "โปร",
      max: 12,
      columns: [
        { key: "title", label: "หัวข้อบนแบนเนอร์", half: true },
        { key: "badge", label: "ป้าย (ใช้หาสินค้า)", half: true },
        { key: "subtitle", label: "คำโปรย" },
        { key: "image", label: "แบนเนอร์", type: "image" },
        { key: "slug", label: "จุดลิงก์ (เช่น buy-1-get-1-free-deal)" },
      ],
    },
    { key: "perPromo", type: "number", label: "จำนวนสินค้าต่อโปร", min: 2, max: 8 },
  ],
  enabledOn: ["page", "campaign", "system"],
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  Component,
};

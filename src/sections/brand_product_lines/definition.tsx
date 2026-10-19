import Link from "next/link";
import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import ProductGridScroll from "@/components/ProductGridScroll";
import ProductTabs from "@/components/ProductTabs";
import { BRAND_GRID, brandPageData, shelfCounts, shelfItemClass } from "@/lib/brand-page";
import type { GroupedProducts } from "@/lib/brand-groups";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { toCardData } from "@/data/card";

// The brand's catalogue, sorted into the kinds of thing it sells.
//
// Each shelf is cut to whole rows (see shelfCounts): it used to stop at eight,
// which at five across left a last row of three that read as stock running
// out. The cut is done in CSS so the same markup serves every width.
//
// Also the home of the "out of stock" message: when a brand has nothing to
// sell, this is the section that would otherwise be a blank, so it is the
// one that says why.

const schema = z.object({
  // Coerced: the form's select hands back "2", the document may hold 2, and
  // both mean the same choice — including at publish, which validates the
  // stored settings as they are.
  rows: z.coerce.number().int().min(1).max(3).default(2),
});

type Data = { brandSlug: string; groups: GroupedProducts[]; all: GroupedProducts; empty: boolean };

async function load(_settings: z.output<typeof schema>, ctx: { slug: string; draftProfile?: boolean }): Promise<Data | null> {
  const page = await brandPageData(ctx.slug, ctx.draftProfile);
  if (!page) return null;
  return {
    brandSlug: page.brand.slug,
    groups: page.groups,
    // The brand's whole catalogue as one more shelf, in the order the page
    // already put it in (sold-out last). Built here rather than in the
    // component so the shelf and the groups are the same shape.
    all: { key: "all", label: "สินค้าทั้งหมด", items: page.items },
    empty: page.items.length === 0,
  };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  if (data.empty) {
    return (
      <section className="container-page mt-8">
        <div className="rounded-xl2 border border-surface-line bg-surface-mist p-8 text-center">
          <p className="font-bold text-brand-ink">สินค้าของแบรนด์นี้หมดชั่วคราว</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            ตอนนี้ยังไม่มีสินค้าของแบรนด์นี้พร้อมส่ง ลองดูแบรนด์อื่นในหมวดเดียวกัน หรือทักแชทให้ทีมงานแจ้งเมื่อของเข้า
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm font-bold">
            <Link href="/shop" className="rounded-full bg-brand-gradient px-5 py-2 text-white">
              ดูสินค้าทั้งหมด
            </Link>
            <Link href="/brands" className="rounded-full border border-surface-line bg-white px-5 py-2 text-brand-ink">
              ดูแบรนด์อื่น
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const { xl, md } = shelfCounts(settings.rows);

  const moreLink = (group: GroupedProducts) =>
    group.items.length > md && (
      <Link
        href={`/shop?brand=${data.brandSlug}`}
        // -my-1 py-1: a 24px target (WCAG 2.5.8) without moving the link off
        // the baseline it shares with what sits beside it. Measured at 16px
        // before this.
        className="-my-1 shrink-0 py-1 text-xs font-bold text-brand-800 underline-offset-2 hover:underline"
      >
        ดูทั้งหมด →
      </Link>
    );

  // `full` is the "สินค้าทั้งหมด" shelf: the one shelf whose label promises
  // the whole catalogue. It is drawn a batch at a time as the page is
  // scrolled — nearly 200 products for the biggest brand, and nobody reads
  // two hundred cards before pressing one.
  const grid = (group: GroupedProducts, full = false) =>
    full ? (
      <ProductGridScroll items={group.items.map(toCardData)} className={BRAND_GRID} />
    ) : (
      <div className={BRAND_GRID}>
        {group.items.slice(0, xl).map((p, i) => (
          <div key={p.slug} className={shelfItemClass(i, settings.rows)}>
            <ProductCard product={toCardData(p)} />
          </div>
        ))}
      </div>
    );

  // One kind of product at a time, chosen from the row of tabs above it.
  //
  // This used to be every shelf stacked down the page, with a separate
  // section of chips at the top that jumped to them — ten screens of grid on
  // a brand like Dentiste, and the control a screen away from the thing it
  // controlled. The chips section is retired; the tabs live here because a
  // tab and the shelf it opens have to be in the same section, for the same
  // reason the sticky category row of /shop does.
  //
  // Every shelf is still rendered here and in the HTML (see ProductTabs);
  // the tabs only decide which one is on screen. Each shelf's heading is for
  // a screen reader rather than the eye, because the tab above it already
  // says those words — what stays visible is what the tab does not say: how
  // many there are, and the way to the rest.
  if (data.groups.length > 1) {
    // "ทั้งหมด" first, and open by default: the tabs are a filter, and a
    // filter that starts on one of its own values hides the rest of the shop
    // from somebody who arrived to see what this brand sells. It is one more
    // shelf and it obeys the same row count — the row count is what keeps a
    // panel from burying the page, and the link beside it still goes to the
    // whole catalogue.
    const shelves = [data.all, ...data.groups];
    return (
      <div className="container-page mt-10">
        <ProductTabs
          ariaLabel="ประเภทสินค้า"
          hashKeys={shelves.map((g) => g.key)}
          labels={shelves.map((g) => `${g.label} (${g.items.length})`)}
          panels={shelves.map((group) => (
            <section key={group.key} id={group.key} className="scroll-mt-24">
              <h2 className="sr-only">{group.label}</h2>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">{group.items.length} รายการ</p>
                {group.key !== "all" && moreLink(group)}
              </div>
              {grid(group, group.key === "all")}
            </section>
          ))}
        />
      </div>
    );
  }

  // A brand with one kind of product has no tab to name its shelf, so that
  // shelf keeps the heading it has always had.
  return (
    <>
      {data.groups.map((group) => (
        <section key={group.key} id={group.key} className="container-page mt-10 scroll-mt-24">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-brand-ink md:text-xl">
              {group.label} <span className="text-sm font-normal text-slate-500">({group.items.length} รายการ)</span>
            </h2>
            {moreLink(group)}
          </div>
          {grid(group)}
        </section>
      ))}
    </>
  );
}

export const brandProductLines: SectionDefinition<typeof schema> = {
  type: "brand_product_lines",
  version: 1,
  label: "สินค้าแยกตามประเภท",
  description: "ชั้นสินค้าของแบรนด์ แบ่งตามประเภทอัตโนมัติ (เซรั่ม กันแดด ฯลฯ) พร้อมแท็บสลับประเภท",
  category: "brand",
  schema,
  defaults: { rows: 2 },
  fields: [
    {
      key: "rows",
      type: "select",
      label: "แสดงกี่แถวต่อประเภท",
      // A select rather than a number box: three sensible answers, not a
      // range. The schema coerces the string the select writes.
      options: [
        ["1", "1 แถว"],
        ["2", "2 แถว"],
        ["3", "3 แถว"],
      ],
    },
  ],
  enabledOn: ["brand"],
  maxPerPage: 1,
  load,
  Component,
};

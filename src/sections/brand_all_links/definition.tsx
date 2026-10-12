import Link from "next/link";
import { z } from "zod";
import { brandPageData } from "@/lib/brand-page";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Every product the brand sells, as plain links, and the way out to the other
// brands.
//
// The shelves above stop after a couple of rows to keep the page light; this
// is how the rest stay one click away — for a shopper scanning for a name,
// and for a crawler that would otherwise never reach them.

const schema = z.object({});

/** A brand this small already has every product on a shelf above. */
const LIST_FROM = 8;

type Data = { brandName: string; items: { slug: string; name: string }[] };

async function load(_settings: z.output<typeof schema>, ctx: { slug: string; draftProfile?: boolean }): Promise<Data | null> {
  const page = await brandPageData(ctx.slug, ctx.draftProfile);
  if (!page) return null;
  return { brandName: page.brand.name, items: page.items.map((p) => ({ slug: p.slug, name: p.name })) };
}

function Component({ data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;
  return (
    <div className="container-page">
      {data.items.length > LIST_FROM && (
        <section className="mt-12 rounded-xl2 border border-surface-line bg-surface-mist p-5">
          <h2 className="mb-3 text-sm font-bold text-brand-ink">
            สินค้า<span translate="no">{data.brandName}</span>ทั้งหมด ({data.items.length} รายการ)
          </h2>
          <ul className="grid gap-x-6 gap-y-1.5 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <li key={p.slug}>
                <Link href={`/product/${p.slug}`} className="underline-offset-2 hover:text-brand-800 hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-center text-sm">
        <Link href="/brands" className="font-bold text-brand-800 underline-offset-2 hover:underline">
          ดูแบรนด์อื่นทั้งหมด
        </Link>
      </p>
    </div>
  );
}

export const brandAllLinks: SectionDefinition<typeof schema> = {
  type: "brand_all_links",
  version: 1,
  label: "รายชื่อสินค้าทั้งหมด",
  description: "ลิงก์สินค้าทุกตัวของแบรนด์ + ลิงก์ไปแบรนด์อื่น (ช่วย SEO)",
  category: "brand",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["brand"],
  maxPerPage: 1,
  load,
  Component,
};

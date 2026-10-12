import { z } from "zod";
import { brandPageData } from "@/lib/brand-page";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The row of chips that jumps to each kind of product the brand sells.
//
// The anchors are the group keys that "สินค้าแยกตามประเภท" uses as ids, so
// this only means something on a page that also has that section — which is
// why a brand with a single group shows no chips at all: one chip pointing at
// the shelf directly underneath it is not navigation.

const schema = z.object({});

type Group = { key: string; label: string; count: number };

async function load(_settings: z.output<typeof schema>, ctx: { slug: string }): Promise<Group[] | null> {
  const page = await brandPageData(ctx.slug);
  if (!page) return null;
  return page.groups.map((g) => ({ key: g.key, label: g.label, count: g.items.length }));
}

function Component({ data }: SectionProps<z.output<typeof schema>, Group[] | null>) {
  const groups = data ?? [];
  if (groups.length <= 1) return null;
  return (
    <nav aria-label="ประเภทสินค้า" className="container-page mt-6 flex flex-wrap gap-2">
      {groups.map((g) => (
        <a
          key={g.key}
          href={`#${g.key}`}
          className="rounded-full border border-surface-line bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:border-brand-teal hover:text-brand-800"
        >
          {g.label} ({g.count})
        </a>
      ))}
    </nav>
  );
}

export const brandGroupTabs: SectionDefinition<typeof schema> = {
  type: "brand_group_tabs",
  version: 1,
  label: "ปุ่มลัดประเภทสินค้า",
  description: "ชิปกดแล้วเลื่อนไปยังกลุ่มสินค้าแต่ละประเภทของแบรนด์",
  category: "brand",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["brand"],
  maxPerPage: 1,
  load,
  Component,
};

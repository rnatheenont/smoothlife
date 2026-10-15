import { z } from "zod";
import RecentlyViewedSection from "@/components/RecentlyViewedSection";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// What this visitor looked at before.
//
// The list lives in the visitor's own browser, so this draws nothing on the
// server and fills in once the page is interactive — which is also why it has
// no `load`: there is nothing here for the server to know. It takes the
// product being viewed only to leave it out of its own list.

const schema = z.object({});

function Component({ ctx }: SectionProps<z.output<typeof schema>>) {
  const slug = ctx.entity?.type === "product" ? ctx.entity.slug : undefined;
  return (
    <section className="container-page">
      <RecentlyViewedSection excludeSlug={slug} />
    </section>
  );
}

export const recentlyViewed: SectionDefinition<typeof schema> = {
  type: "recently_viewed",
  version: 1,
  label: "ดูล่าสุด",
  description: "สินค้าที่ผู้เข้าชมคนนี้เพิ่งดู — อ่านจากเบราว์เซอร์ของเขาเอง",
  category: "product",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["template"],
  requiresEntity: ["product"],
  maxPerPage: 1,
  Component,
};

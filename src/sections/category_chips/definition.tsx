import { z } from "zod";
import CategoryChips from "@/components/CategoryChips";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The other categories, as chips, on phones only.
//
// Hidden from lg because the filter sidebar there already lists them, and two
// lists of the same six categories on one screen is one list too many. It
// bleeds past the page gutter on purpose — a row you can push off the edge
// reads as scrollable, a row that stops neatly at the margin does not.

const schema = z.object({});

function Component({ ctx }: SectionProps<z.output<typeof schema>>) {
  const category = ctx.entity?.type === "category" ? ctx.entity.slug : undefined;
  if (!category) return null;
  return (
    <section className="container-page">
      <CategoryChips current={{ ...(ctx.query ?? {}), category }} />
    </section>
  );
}

export const categoryChips: SectionDefinition<typeof schema> = {
  type: "category_chips",
  version: 1,
  label: "ชิปหมวดอื่น (มือถือ)",
  description: "แถวชิปหมวดสินค้าอื่น แสดงบนมือถือเท่านั้น — บนจอใหญ่ตัวกรองด้านข้างทำหน้าที่นี้แล้ว",
  category: "product",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["template"],
  requiresEntity: ["category"],
  locked: true,
  maxPerPage: 1,
  Component,
};

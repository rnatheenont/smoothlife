import { z } from "zod";
import ConcernCoverflow from "@/components/home/ConcernCoverflow";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Shop by concern — the other way in, for somebody who knows what is
// bothering them but not what to buy for it. The component owns its own band
// background and carousel controls.

const schema = z.object({});

function Component(_props: SectionProps<z.output<typeof schema>>) {
  return <ConcernCoverflow />;
}

export const concernCoverflow: SectionDefinition<typeof schema> = {
  type: "concern_coverflow",
  version: 1,
  label: "เลือกตามปัญหาที่กังวล",
  description: "คาโรเซลปัญหาผิวและสุขภาพ กดแล้วไปหน้าสินค้าของเรื่องนั้น",
  category: "product",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["home", "page"],
  maxPerPage: 1,
  Component,
};

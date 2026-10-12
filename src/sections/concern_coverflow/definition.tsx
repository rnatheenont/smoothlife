import { z } from "zod";
import ConcernCoverflow from "@/components/home/ConcernCoverflow";
import { concerns } from "@/data/categories";
import { concernShelves } from "@/lib/article-products";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Shop by concern — the other way in, for somebody who knows what is
// bothering them but not what to buy for it. The component owns its own band
// background and carousel controls.

const schema = z.object({});

/** Ten per concern, which is what the carousel shows before it scrolls. */
const SHELF = 10;

function Component(_props: SectionProps<z.output<typeof schema>>) {
  // Picked here, on the server: the carousel used to filter the catalogue
  // itself, which is why the catalogue was in the browser.
  return <ConcernCoverflow byConcern={concernShelves(SHELF, [concerns[0].slug])} />;
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

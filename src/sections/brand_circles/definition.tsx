import { z } from "zod";
import BrandCircleRow from "@/components/home/BrandCircleRow";
import { brands } from "@/data/brands";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The row of brand circles.
//
// Which brands appear used to be a nine-slug array inside the component, so
// changing it was a code change and a deploy. It is a setting now — which is
// the whole point of this system — and the component still falls back to
// filling any gap from the rest of the catalogue, so a brand removed from
// brands.ts leaves nine circles with a substitute rather than a hole.

const schema = z.object({
  brandSlugs: z.array(z.string().min(1)).min(1).max(12),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  // The whole catalogue goes down, and the stored order decides who leads.
  // The component keeps its own rule for filling a gap, so a brand dropped
  // from brands.ts leaves a substitute rather than a hole in the row.
  return <BrandCircleRow brands={brands} featured={settings.brandSlugs} />;
}

export const brandCircles: SectionDefinition<typeof schema> = {
  type: "brand_circles",
  version: 1,
  label: "วงกลมแบรนด์",
  description: "แถวแบรนด์เด่น กดแล้วเปิดแผงสินค้าของแบรนด์นั้นในหน้าเดิม",
  category: "brand",
  schema,
  // The nine that were hard-coded in the component, in their original order.
  defaults: {
    brandSlugs: [
      "smooth-e",
      "dentiste",
      "janeke",
      "eucerin",
      "cerave",
      "blackmores",
      "mega",
      "swisse",
      "vichy",
    ],
  },
  fields: [{ key: "brandSlugs", type: "brand_slugs", label: "แบรนด์ที่จะแสดง", max: 12, help: "เรียงตามลำดับที่อยากให้เห็น" }],
  enabledOn: ["home", "page"],
  maxPerPage: 1,
  Component,
};

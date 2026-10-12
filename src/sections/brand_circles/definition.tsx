import { z } from "zod";
import BrandCircleRow from "@/components/home/BrandCircleRow";
import AuroraBackdrop from "@/components/home/AuroraBackdrop";
import SectionHeading from "@/components/SectionHeading";
import ScrollReveal from "@/components/ScrollReveal";
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
  title: z.string().max(60).default("แบรนด์ที่คุณไว้วางใจ"),
  subtitle: z.string().max(40).default("Brands"),
  /** The heading's "ดูทั้งหมด" link. With nine brands on show it is the only
   *  route to the rest of the catalogue's vendors, so it is not optional in
   *  practice even though the field allows an empty string. */
  href: z.string().default("/brands"),
  brandSlugs: z.array(z.string().min(1)).min(1).max(12),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  // The whole catalogue goes down, and the stored order decides who leads.
  // The component keeps its own rule for filling a gap, so a brand dropped
  // from brands.ts leaves a substitute rather than a hole in the row.
  return (
    <section className="relative isolate overflow-hidden bg-[#f6fcfb] py-5 md:py-8 lg:py-10">
      <AuroraBackdrop />
      <ScrollReveal className="container-page">
        <SectionHeading title={settings.title} subtitle={settings.subtitle} href={settings.href || undefined} />
      </ScrollReveal>
      <ScrollReveal>
        <BrandCircleRow brands={brands} featured={settings.brandSlugs} />
      </ScrollReveal>
    </section>
  );
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
    title: "แบรนด์ที่คุณไว้วางใจ",
    subtitle: "Brands",
    href: "/brands",
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
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    { key: "subtitle", type: "text", label: "หัวข้อย่อย (อังกฤษ)" },
    { key: "href", type: "text", label: "ลิงก์ \"ดูทั้งหมด\"" },
    { key: "brandSlugs", type: "brand_slugs", label: "แบรนด์ที่จะแสดง", max: 12, help: "เรียงตามลำดับที่อยากให้เห็น" },
  ],
  enabledOn: ["home", "page"],
  maxPerPage: 1,
  Component,
};

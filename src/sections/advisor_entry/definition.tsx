import { z } from "zod";
import AdvisorPopup from "@/components/shop/AdvisorPopup";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The way in to an advisor, for the categories that have one. It draws a
// popup in the corner — see components/shop/AdvisorPopup.
//
// This is the editable half of the category template. Today the two entries
// that exist — oral care and wellness — are a map hard-coded in the route, so
// adding one for skincare, or changing the question after watching people not
// click it, is a deploy. Written as a row per category instead: a category
// with no row gets no card, which is how the page already behaves for the
// four categories the map does not mention.

const schema = z.object({
  image: z.string().default(""),
  items: z
    .array(
      z.object({
        category: z.string().max(40).default(""),
        href: z.string().default(""),
        title: z.string().max(120).default(""),
        subtitle: z.string().max(200).default(""),
      })
    )
    .max(12)
    .default([]),
});

function Component({ settings, ctx }: SectionProps<z.output<typeof schema>>) {
  const category = ctx.entity?.type === "category" ? ctx.entity.slug : undefined;
  const entry = settings.items.find((i) => i.category === category && i.href && i.title);
  if (!entry) return null;

  // A popup rather than the card this used to draw — see AdvisorPopup for
  // why. The section still owns the copy and which categories get one; all
  // that changed is where it appears.
  return (
    <AdvisorPopup
      category={entry.category}
      href={entry.href}
      title={entry.title}
      subtitle={entry.subtitle}
      image={settings.image || undefined}
    />
  );
}

export const advisorEntry: SectionDefinition<typeof schema> = {
  type: "advisor_entry",
  version: 1,
  label: "ป๊อปอัปชวนไปที่ปรึกษา",
  description: "ป๊อปอัปมุมจอพร้อมรูปน้อง Smoothie — ใส่ได้หมวดละแถว หมวดที่ไม่มีแถวก็ไม่มีป๊อปอัป",
  category: "promo",
  schema,
  defaults: {
    image: "/mascot/smoothie-hi.png",
    items: [
      {
        category: "oral-care",
        href: "/oral-care-advisor",
        title: "ไม่รู้จะเริ่มจากตัวไหนดี?",
        subtitle: "ตอบ 3 คำถาม ให้น้อง Smoothie จัดเซ็ตดูแลช่องปากที่ใช่สำหรับคุณ",
      },
      {
        category: "wellness",
        href: "/supplement-advisor",
        title: "อาหารเสริมเยอะจนเลือกไม่ถูก?",
        subtitle: "ตอบ 5 คำถาม ให้น้อง Smoothie ช่วยหาแพลนที่ตรงเป้าหมายและงบของคุณ",
      },
    ],
  },
  fields: [
    { key: "image", type: "image", label: "รูปในป๊อปอัป" },
    {
      key: "items",
      type: "list",
      label: "ป๊อปอัปแต่ละหมวด",
      item: "หมวด",
      max: 12,
      columns: [
        { key: "category", label: "รหัสหมวด", half: true, placeholder: "oral-care" },
        { key: "href", label: "ลิงก์", half: true },
        { key: "title", label: "คำถาม" },
        { key: "subtitle", label: "คำอธิบาย", type: "textarea" },
      ],
    },
  ],
  enabledOn: ["template"],
  requiresEntity: ["category"],
  maxPerPage: 1,
  Component,
};

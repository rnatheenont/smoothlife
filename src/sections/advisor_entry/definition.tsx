import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The way in to an advisor, for the categories that have one.
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

  return (
    <section className="container-page">
      <Link
        href={entry.href}
        className="group mb-6 flex items-center gap-4 rounded-xl2 bg-brand-ink p-4 text-white shadow-cardHover transition-transform md:p-5"
      >
        {settings.image && (
          <div className="relative h-12 w-12 shrink-0">
            <Image src={settings.image} alt="Smoothie" fill sizes="48px" className="object-contain" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{entry.title}</p>
          {entry.subtitle && <p className="mt-0.5 text-xs text-white/60">{entry.subtitle}</p>}
        </div>
        <ChevronRight size={20} className="shrink-0 text-white/50 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}

export const advisorEntry: SectionDefinition<typeof schema> = {
  type: "advisor_entry",
  version: 1,
  label: "การ์ดชวนไปที่ปรึกษา",
  description: "การ์ดดำพร้อมรูปน้อง Smoothie — ใส่ได้หมวดละแถว หมวดที่ไม่มีแถวก็ไม่มีการ์ด",
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
    { key: "image", type: "image", label: "รูปในการ์ด" },
    {
      key: "items",
      type: "list",
      label: "การ์ดแต่ละหมวด",
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

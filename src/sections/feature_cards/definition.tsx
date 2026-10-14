import Link from "next/link";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { CONTENT_ICON_KEYS, contentIcon } from "../shared/content-icons";

// The grid of cards that every content page on the site already has: a mark,
// a short title, a couple of lines, and sometimes a link.
//
// Same card as ContentPage draws — rounded, shadow-card, the mint circle
// behind the icon — because the first job of these sections is to let a page
// move into the system without moving on the screen.

const item = z.object({
  icon: z.string().default(""),
  title: z.string().max(80).default(""),
  body: z.string().max(400).default(""),
  href: z.string().default(""),
});

const schema = z.object({
  heading: z.string().max(120).default(""),
  items: z.array(item).max(12).default([]),
  columns: z.enum(["2", "3", "4"]).default("2"),
});

const COLUMNS: Record<string, string> = {
  "2": "md:grid-cols-2",
  "3": "md:grid-cols-2 lg:grid-cols-3",
  "4": "md:grid-cols-2 lg:grid-cols-4",
};

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = settings.items.filter((i) => i.title || i.body);
  if (items.length === 0) return null;

  return (
    <section className="container-page pb-8 md:pb-10">
      {settings.heading && (
        <h2 className="mb-5 text-xl font-bold text-brand-ink md:text-2xl">{settings.heading}</h2>
      )}
      <div className={`grid gap-5 ${COLUMNS[settings.columns] ?? COLUMNS["2"]}`}>
        {items.map((card, i) => {
          const Icon = contentIcon(card.icon);
          // A card with a link is a link; one without is not. Wrapping every
          // card in an <a href=""> would hand a keyboard user a stop on
          // something that goes nowhere.
          const inner = (
            <>
              {Icon && (
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                  <Icon size={18} />
                </div>
              )}
              <h3 className="mb-1.5 font-bold text-brand-ink">{card.title}</h3>
              <p className="text-sm text-slate-600">{card.body}</p>
            </>
          );
          const className = "rounded-xl2 p-5 shadow-card";
          return card.href ? (
            <Link key={i} href={card.href} className={`${className} transition-shadow hover:shadow-lg`}>
              {inner}
            </Link>
          ) : (
            <div key={i} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const featureCards: SectionDefinition<typeof schema> = {
  type: "feature_cards",
  version: 1,
  label: "การ์ดหัวข้อ",
  description: "การ์ดไอคอน + หัวข้อ + คำอธิบาย เรียงเป็นตาราง 2–4 คอลัมน์",
  category: "content",
  schema,
  defaults: {
    heading: "",
    columns: "2",
    items: [
      { icon: "shield", title: "ของแท้ 100%", body: "นำเข้าและจัดจำหน่ายโดยตรง พร้อมการรับรองจาก อย.", href: "" },
      { icon: "truck", title: "ส่งเร็วทั่วไทย", body: "จัดส่งภายใน 1–3 วันทำการ", href: "" },
    ],
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อกลุ่ม" },
    {
      key: "columns",
      type: "select",
      label: "จำนวนคอลัมน์ (จอใหญ่)",
      options: [["2", "2 คอลัมน์"], ["3", "3 คอลัมน์"], ["4", "4 คอลัมน์"]],
    },
    {
      key: "items",
      type: "json",
      label: "การ์ด",
      help: `แต่ละอัน: icon, title, body, href — ไอคอนที่เลือกได้: ${CONTENT_ICON_KEYS.join(", ")}`,
    },
  ],
  enabledOn: ["page", "campaign", "brand", "system", "template"],
  Component,
};

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// A row of links to the pages under this one — /about to its three sub-pages,
// /help to its topics.
//
// Pills rather than a list, because this is navigation between siblings and
// it sits between blocks of prose: a bulleted list there reads as more
// content, and the thing people are looking for when they reach the bottom of
// a page like this is where to go next.

const schema = z.object({
  heading: z.string().max(120).default(""),
  items: z
    .array(z.object({ label: z.string().max(60).default(""), href: z.string().default("") }))
    .max(12)
    .default([]),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = settings.items.filter((i) => i.label && i.href);
  if (items.length === 0) return null;

  return (
    <section className="container-page pb-10">
      {settings.heading && (
        <h2 className="mb-4 text-xl font-bold text-brand-ink md:text-2xl">{settings.heading}</h2>
      )}
      <ul className="flex flex-wrap gap-2.5">
        {items.map((item, i) => (
          <li key={i}>
            <Link
              href={item.href}
              className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-ink shadow-card transition-colors hover:text-brand-800"
            >
              {item.label}
              <ChevronRight size={14} className="text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const linkPills: SectionDefinition<typeof schema> = {
  type: "link_pills",
  version: 1,
  label: "ปุ่มลิงก์",
  description: "แถวปุ่มลิงก์ไปหน้าย่อยหรือหน้าที่เกี่ยวข้อง",
  category: "content",
  schema,
  defaults: {
    heading: "",
    items: [
      { label: "คุณภาพและมาตรฐาน", href: "/about/quality" },
      { label: "ทีมผู้เชี่ยวชาญ", href: "/about/experts" },
    ],
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อกลุ่ม" },
    { key: "items", type: "json", label: "ลิงก์", help: "แต่ละอัน: label, href" },
  ],
  enabledOn: ["page", "campaign", "brand", "system", "template"],
  Component,
};

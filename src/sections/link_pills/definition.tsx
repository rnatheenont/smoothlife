import Link from "next/link";
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
  /**
   * How much room under the row.
   *
   * These pills do two different jobs on this site. At the foot of /about
   * they are where to go next, with the end of the page under them; near the
   * top of /knowledge they are the hub's own navigation, with the hub's
   * content under them. Same pills, different gap — "end" is the original and
   * stays the default so no page that already uses this moves.
   */
  room: z.enum(["end", "under_header"]).default("end"),
});

const ROOM: Record<string, string> = { end: "pb-14", under_header: "pb-8" };

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = settings.items.filter((i) => i.label && i.href);
  if (items.length === 0) return null;

  return (
    <section className={`container-page ${ROOM[settings.room] ?? ROOM.end}`}>
      {settings.heading && (
        <h2 className="mb-4 text-xl font-bold text-brand-ink md:text-2xl">{settings.heading}</h2>
      )}
      <ul className="flex flex-wrap gap-3">
        {items.map((item, i) => (
          <li key={i}>
            {/* The outlined pill the site already uses on /about — matched
                rather than redesigned, so a page moving into the system does
                not change on the day it moves. */}
            <Link
              href={item.href}
              className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-medium transition-colors hover:border-brand-teal"
            >
              {item.label}
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
    room: "end",
    items: [
      { label: "คุณภาพและมาตรฐาน", href: "/about/quality" },
      { label: "ทีมผู้เชี่ยวชาญ", href: "/about/experts" },
    ],
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อกลุ่ม" },
    {
      key: "items",
      type: "list",
      label: "ลิงก์",
      item: "ปุ่ม",
      max: 12,
      columns: [
        { key: "label", label: "ข้อความ", half: true },
        { key: "href", label: "ลิงก์", half: true },
      ],
    },
    {
      key: "room",
      type: "select",
      label: "ระยะใต้แถวปุ่ม",
      options: [
        ["end", "บล็อกสุดท้ายของหน้า"],
        ["under_header", "เป็นเมนูใต้หัวหน้า"],
      ],
    },
  ],
  enabledOn: ["page", "campaign", "brand", "system", "template"],
  Component,
};

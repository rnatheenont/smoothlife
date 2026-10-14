import { ChevronDown } from "lucide-react";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { helpFaqs } from "@/data/help";

// Questions and answers, from wherever the shop already keeps them.
//
// The same list appears on /help, inside the chat's suggestions and in the
// structured data search engines read, and until now each of those had its
// own copy of the words. The source setting is what keeps that from
// happening again: a page says where its questions come from, not what they
// are, so editing them in one place changes all three.
//
// `manual` is for the questions that belong to one page and nowhere else —
// the four about a campaign's rules. `kb` (the public FAQ table) arrives with
// the knowledge pages in wave 2; it is deliberately absent here rather than
// present and broken.
//
// Drawn with <details>, so it opens and closes with no JavaScript at all.
// An accordion is the one widget where that still works perfectly.
//
// No FAQPage structured data here. The page that holds the questions emits
// it, because a page may carry two of these — a campaign's rules and the
// shop's general questions — and two FAQPage blocks on one page is a page
// that describes itself twice.

const schema = z.object({
  heading: z.string().max(120).default(""),
  source: z.enum(["manual", "help"]).default("manual"),
  items: z
    .array(z.object({ q: z.string().max(200).default(""), a: z.string().max(2000).default("") }))
    .max(30)
    .default([]),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = (settings.source === "help" ? helpFaqs : settings.items).filter((i) => i.q && i.a);
  if (items.length === 0) return null;

  return (
    <section className="container-page pb-8 md:pb-10">
      {settings.heading && <h2 className="mb-4 font-bold text-brand-ink">{settings.heading}</h2>}
      {/* <details> rather than the click handler the site used before: it is
          the same accordion with no JavaScript at all, `name` gives the
          one-open-at-a-time behaviour natively, and the first one starts
          open exactly as it did. */}
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <details
            key={i}
            name="faq"
            open={i === 0}
            className="group overflow-hidden rounded-xl border border-slate-100"
          >
            <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 p-4 text-left">
              <span className="text-sm font-semibold text-brand-ink">{item.q}</span>
              <ChevronDown
                size={16}
                className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="px-4 pb-4 text-sm text-slate-600">{item.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

export const faq: SectionDefinition<typeof schema> = {
  type: "faq",
  version: 1,
  label: "คำถามที่พบบ่อย",
  description: "รายการคำถาม–คำตอบ แบบพับเก็บได้ พร้อมข้อมูลให้ Google อ่าน",
  category: "content",
  schema,
  defaults: {
    heading: "คำถามที่พบบ่อย",
    source: "help",
    items: [],
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    {
      key: "source",
      type: "select",
      label: "ดึงคำถามจาก",
      options: [
        ["help", "ชุดคำถามกลางของศูนย์ช่วยเหลือ"],
        ["manual", "พิมพ์เองเฉพาะหน้านี้"],
      ],
      help: "เลือกชุดกลางแล้วแก้ที่เดียวจะเปลี่ยนทุกหน้าที่ใช้",
    },
    { key: "items", type: "json", label: "คำถาม (เฉพาะโหมดพิมพ์เอง)", help: "แต่ละอัน: q, a" },
  ],
  enabledOn: ["page", "campaign", "system", "template"],
  Component,
};

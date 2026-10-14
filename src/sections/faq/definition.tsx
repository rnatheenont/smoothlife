import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { helpFaqs } from "@/data/help";
import { jsonLdScript } from "@/lib/json-ld";

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section className="container-page pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      {settings.heading && (
        <h2 className="mb-5 text-xl font-bold text-brand-ink md:text-2xl">{settings.heading}</h2>
      )}
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <details key={i} className="group rounded-xl2 bg-white px-5 py-4 shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-brand-ink">
              {item.q}
              {/* Drawn rather than an icon component: it has to rotate on the
                  parent's open state, and that is one line of CSS here. */}
              <span className="shrink-0 text-slate-300 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{item.a}</p>
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

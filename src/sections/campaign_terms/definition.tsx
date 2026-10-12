import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The campaign's conditions, folded away.
//
// <details> rather than a React toggle on purpose: it opens without
// JavaScript, it is in the accessibility tree as a disclosure without any
// aria- attributes being added by hand, and the browser's own find-in-page
// opens it to show a match. A campaign's terms are the one thing on the page
// somebody will search for a specific word in.

const schema = z.object({
  title: z.string().max(80).default("เงื่อนไขแคมเปญ"),
  body: z.string().max(6000).default(""),
  openByDefault: z.boolean().default(false),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const lines = settings.body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  return (
    <section className="container-page py-6 md:py-8">
      <details open={settings.openByDefault} className="rounded-xl2 border border-surface-line bg-white">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-brand-ink">
          {settings.title}
        </summary>
        <ul className="list-disc space-y-1.5 px-4 pb-4 pl-9 text-[13px] leading-relaxed text-grey-600">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export const campaignTerms: SectionDefinition<typeof schema> = {
  type: "campaign_terms",
  version: 1,
  label: "เงื่อนไข (พับได้)",
  description: "หนึ่งบรรทัดต่อหนึ่งข้อ · เปิดได้แม้ JavaScript ไม่ทำงาน",
  category: "content",
  schema,
  defaults: {
    title: "เงื่อนไขแคมเปญ",
    body: "ส่วนลดใช้ได้ภายในช่วงเวลาที่กำหนดเท่านั้น\nสงวนสิทธิ์ในการเปลี่ยนแปลงเงื่อนไขโดยไม่ต้องแจ้งล่วงหน้า",
    openByDefault: false,
  },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    { key: "body", type: "textarea", label: "เงื่อนไข", help: "ขึ้นบรรทัดใหม่ = ข้อใหม่" },
    { key: "openByDefault", type: "toggle", label: "เปิดอ่านไว้ตั้งแต่แรก" },
  ],
  enabledOn: ["campaign", "page", "home", "brand"],
  check: async (settings) =>
    settings.body.trim() ? [] : [{ level: "warning" as const, message: "section เงื่อนไขยังไม่มีข้อความ — จะไม่แสดง" }],
  Component,
};

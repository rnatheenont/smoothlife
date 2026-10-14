import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Words on the page: a heading and some paragraphs.
//
// Plain text, not HTML. An admin pasting from Word brings a document's worth
// of span tags with it, and a section that renders whatever arrives is a
// section that can break the page's typography — or worse, carry a script.
// Blank lines separate paragraphs, which is how people type anyway.

const schema = z.object({
  eyebrow: z.string().max(60).default(""),
  heading: z.string().max(120).default(""),
  body: z.string().max(4000).default(""),
  align: z.enum(["left", "center"]).default("left"),
  background: z.enum(["page", "white", "soft"]).default("page"),
});

const BACKGROUND: Record<string, string> = {
  page: "",
  white: "bg-white",
  soft: "bg-surface-soft",
};

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const paragraphs = settings.body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (!settings.heading && paragraphs.length === 0) return null;

  return (
    <section className={`${BACKGROUND[settings.background] ?? ""} py-10 md:py-14`}>
      <div className={`container-page ${settings.align === "center" ? "text-center" : ""}`}>
        {settings.eyebrow && (
          <p className="text-[13px] font-medium tracking-[0.04em] text-slate-500">{settings.eyebrow}</p>
        )}
        {settings.heading && (
          <h2 className="mt-2 text-[26px] font-bold leading-[1.4] text-brand-ink md:text-[34px]">
            {settings.heading}
          </h2>
        )}
        {paragraphs.length > 0 && (
          // 68ch rather than the full width: Thai has no spaces between
          // words, so a long line is harder to come back to than it looks.
          <div
            className={`mt-4 flex max-w-[68ch] flex-col gap-3 text-[15px] leading-relaxed text-slate-600 md:text-base ${
              settings.align === "center" ? "mx-auto" : ""
            }`}
          >
            {paragraphs.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const richText: SectionDefinition<typeof schema> = {
  type: "rich_text",
  version: 1,
  label: "ข้อความ",
  description: "หัวข้อและย่อหน้า เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่",
  category: "content",
  schema,
  defaults: { eyebrow: "", heading: "หัวข้อ", body: "เขียนข้อความที่นี่", align: "left", background: "page" },
  fields: [
    { key: "eyebrow", type: "text", label: "คำนำหัวข้อ" },
    { key: "heading", type: "text", label: "หัวข้อ" },
    { key: "body", type: "textarea", label: "เนื้อหา", help: "เว้นบรรทัดว่างหนึ่งบรรทัดเพื่อขึ้นย่อหน้าใหม่" },
    { key: "align", type: "select", label: "การจัดวาง", options: [["left", "ชิดซ้าย"], ["center", "กึ่งกลาง"]] },
    {
      key: "background",
      type: "select",
      label: "พื้นหลัง",
      options: [["page", "ตามพื้นหน้า"], ["white", "ขาว"], ["soft", "เขียวอ่อน"]],
    },
  ],
  enabledOn: ["home", "page", "campaign", "brand", "system", "template"],
  Component,
};

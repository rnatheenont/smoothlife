import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { parseLegal, type LegalBlock } from "./parse";

// A long document with headings: the privacy policy, the terms.
//
// Not rich_text with a bigger box. Two things make these different from every
// other block of words on the site, and both of them are why they get their
// own section:
//
//   • they are read by somebody looking for one clause, so they need a table
//     of contents, and it has to be built from the document rather than
//     maintained beside it;
//   • the date they last changed is part of the document's meaning, not
//     decoration, so it is a field instead of a line somebody remembers to
//     edit inside the text.
//
// Headings are marked the way people already type them — a line starting with
// ## or ### — rather than by pasting HTML. The alternative is accepting markup
// from a text box, which is how a policy page ends up carrying a script.

const schema = z.object({
  body: z.string().max(60000).default(""),
  updatedAt: z.string().max(40).default(""),
  showToc: z.boolean().default(true),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const blocks = parseLegal(settings.body);
  if (blocks.length === 0) return null;
  // Only the top level goes in the contents. A policy's sub-clauses are what
  // you read once you are in the right section, not how you find it.
  const toc = blocks.filter((b): b is Extract<LegalBlock, { kind: "h2" }> => b.kind === "h2");

  return (
    <section className="container-page pb-12">
      {settings.updatedAt && (
        <p className="mb-6 text-xs text-slate-500">ปรับปรุงล่าสุด {settings.updatedAt}</p>
      )}

      {settings.showToc && toc.length > 1 && (
        <nav aria-label="สารบัญ" className="mb-8 rounded-xl2 bg-surface-soft p-5">
          <p className="mb-3 text-sm font-bold text-brand-ink">สารบัญ</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-slate-600 marker:text-slate-400">
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="transition-colors hover:text-brand-800">
                  {item.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="max-w-[72ch]">
        {blocks.map((block, i) => {
          if (block.kind === "h2")
            return (
              // scroll-mt so a heading jumped to from the contents does not
              // land underneath the sticky header.
              <h2
                key={i}
                id={block.id}
                className="mt-8 scroll-mt-24 text-lg font-bold text-brand-ink first:mt-0 md:text-xl"
              >
                {block.text}
              </h2>
            );
          if (block.kind === "h3")
            return (
              <h3 key={i} id={block.id} className="mt-5 scroll-mt-24 font-bold text-brand-ink">
                {block.text}
              </h3>
            );
          return (
            <p key={i} className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {block.text}
            </p>
          );
        })}
      </div>
    </section>
  );
}

export const legalDocument: SectionDefinition<typeof schema> = {
  type: "legal_document",
  version: 1,
  label: "เอกสารทางกฎหมาย",
  description: "ข้อความยาวที่มีหัวข้อย่อย พร้อมสารบัญอัตโนมัติและวันที่ปรับปรุง",
  category: "content",
  schema,
  defaults: {
    body: "## หัวข้อแรก\n\nเนื้อหาของหัวข้อแรก\n\n## หัวข้อที่สอง\n\nเนื้อหาของหัวข้อที่สอง",
    updatedAt: "",
    showToc: true,
  },
  fields: [
    {
      key: "body",
      type: "textarea",
      label: "เนื้อหา",
      help: 'ขึ้นหัวข้อด้วย "## " และหัวข้อย่อยด้วย "### " · เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่',
    },
    { key: "updatedAt", type: "text", label: "ปรับปรุงล่าสุด", help: "เช่น 14 ตุลาคม 2569" },
    { key: "showToc", type: "toggle", label: "แสดงสารบัญ" },
  ],
  enabledOn: ["page", "system"],
  maxPerPage: 1,
  Component,
};

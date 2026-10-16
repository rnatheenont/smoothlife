import { z } from "zod";
import { lText, tx } from "@/lib/i18n/localized";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { groupLegal, parseLegal, type LegalBlock } from "./parse";

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
  intro: lText(600).default(""),
  body: lText(60000).default(""),
  updatedAt: lText(40).default(""),
  showToc: z.boolean().default(true),
  /** The line at the foot of a policy that says where to ask about it. Its
   *  own fields rather than part of the body, because it is the one piece of
   *  a document like this that carries a link and is set in smaller type. */
  footnote: lText(300).default(""),
  footnoteLinkLabel: lText(60).default(""),
  footnoteHref: z.string().default(""),
});

// The two words this section says itself rather than reading from the
// document. They live here because there are two of them and they belong to
// this section's furniture; the shop's shared dictionary (plan §B3) is where
// they move once it exists.
const UPDATED_LABEL = { th: "ปรับปรุงล่าสุด", en: "Last updated" } as const;
const TOC_LABEL = { th: "สารบัญ", en: "Contents" } as const;

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "ul")
          return (
            <ul key={i} className="space-y-2">
              {block.items.map((item, j) => (
                <li key={j} className="text-sm leading-relaxed text-slate-600">
                  {item}
                </li>
              ))}
            </ul>
          );
        if (block.kind === "h3")
          return (
            <h3 key={i} id={block.id} className="mt-4 scroll-mt-24 font-bold text-brand-ink">
              {block.text}
            </h3>
          );
        return (
          <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {block.text}
          </p>
        );
      })}
    </>
  );
}

function Component({ settings, ctx }: SectionProps<z.output<typeof schema>>) {
  // The document is read in one language and then parsed, so the headings,
  // the contents list and the ids it links with are all built from the same
  // words. A translated policy therefore gets its own anchors — #section-2
  // of the English terms points into the English text, which is what a link
  // shared from that page has to do.
  const intro = tx(settings.intro, ctx.locale);
  const updatedAt = tx(settings.updatedAt, ctx.locale);
  const footnote = tx(settings.footnote, ctx.locale);
  const footnoteLinkLabel = tx(settings.footnoteLinkLabel, ctx.locale);

  const groups = groupLegal(parseLegal(tx(settings.body, ctx.locale)));
  if (groups.length === 0 && !intro) return null;
  // Only the top level goes in the contents. A policy's sub-clauses are what
  // you read once you are in the right section, not how you find it.
  const toc = groups.map((g) => g.heading).filter((h): h is NonNullable<typeof h> => Boolean(h));

  return (
    <section className="container-page pb-8 md:pb-10">
      {intro && <p className="mb-8 text-sm text-slate-500">{intro}</p>}
      {updatedAt && <p className="mb-6 text-xs text-slate-500">{UPDATED_LABEL[ctx.locale]} {updatedAt}</p>}

      {settings.showToc && toc.length > 1 && (
        <nav aria-label={TOC_LABEL[ctx.locale]} className="mb-8 rounded-xl2 bg-surface-soft p-5">
          <p className="mb-3 text-sm font-bold text-brand-ink">{TOC_LABEL[ctx.locale]}</p>
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

      <div className="flex flex-col gap-8">
        {groups.map((group, i) => (
          <div key={i}>
            {group.heading && (
              // scroll-mt so a heading jumped to from the contents does not
              // land underneath the sticky header.
              <h2 id={group.heading.id} className="mb-3 scroll-mt-24 font-bold text-brand-ink">
                {group.heading.text}
              </h2>
            )}
            <Blocks blocks={group.blocks} />
          </div>
        ))}
      </div>

      {footnote && (
        <p className="mt-10 text-xs text-slate-500">
          {footnote}
          {footnoteLinkLabel && settings.footnoteHref && (
            <>
              {" "}
              <a href={settings.footnoteHref} className="text-brand-800 hover:underline">
                {footnoteLinkLabel}
              </a>
            </>
          )}
        </p>
      )}
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
    intro: "",
    body: "## หัวข้อแรก\n\nเนื้อหาของหัวข้อแรก\n\n## หัวข้อที่สอง\n\nเนื้อหาของหัวข้อที่สอง",
    updatedAt: "",
    showToc: true,
    footnote: "",
    footnoteLinkLabel: "",
    footnoteHref: "",
  },
  fields: [
    { key: "intro", type: "textarea", label: "คำนำใต้หัวข้อ", localized: true },
    {
      key: "body",
      type: "textarea",
      label: "เนื้อหา",
      help: 'ขึ้นหัวข้อด้วย "## " หัวข้อย่อยด้วย "### " · ขึ้นต้นบรรทัดด้วย "- " เพื่อทำรายการ · เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่',
      localized: true,
    },
    { key: "updatedAt", type: "text", label: "ปรับปรุงล่าสุด", help: "เช่น 14 ตุลาคม 2569", localized: true },
    { key: "showToc", type: "toggle", label: "แสดงสารบัญ" },
    {
      key: "footnote",
      type: "text",
      label: "บรรทัดปิดท้าย",
      help: "เช่น หากมีคำถามเกี่ยวกับนโยบายนี้ กรุณาติดต่อทีมงานผ่าน",
      localized: true,
    },
    { key: "footnoteLinkLabel", type: "text", label: "ข้อความลิงก์ปิดท้าย", localized: true },
    { key: "footnoteHref", type: "text", label: "ลิงก์ปิดท้าย" },
  ],
  enabledOn: ["page", "system"],
  maxPerPage: 1,
  Component,
};

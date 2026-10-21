import { ChevronDown } from "lucide-react";
import { z } from "zod";
import type { RenderCtx, SectionDefinition, SectionProps } from "@/lib/pages/types";
import { helpFaqs } from "@/data/help";
import { answerParagraphs, faqForContext } from "@/lib/faq-public";
import { getProductBySlug } from "@/data/products";

// Questions and answers, from wherever the shop already keeps them.
//
// The same list appears on /help, inside the chat's suggestions and in the
// structured data search engines read, and until now each of those had its
// own copy of the words. The source setting is what keeps that from
// happening again: a page says where its questions come from, not what they
// are, so editing them in one place changes all three.
//
// `manual` is for the questions that belong to one page and nowhere else —
// the four about a campaign's rules. `kb` reads the published FAQ, so a
// question written once in the FAQ centre shows up on the product page, the
// brand page and the concern page it belongs to, and editing it there
// changes all of them.
//
// `kb` in "auto" mode works out what the page is about rather than being
// told: a concern page asks for that concern, a brand page for that brand, a
// product page asks three times — its own tag, then its brand, then the
// concerns it is sold for — and anything else falls back to the pinned
// ordering questions. Being told is still available for the pages where the
// guess is wrong.
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
  source: z.enum(["manual", "help", "kb"]).default("manual"),
  /** kb only. New fields with defaults, so no stored document needs migrating. */
  kbMode: z.enum(["auto", "topic", "concern", "brand", "pinned"]).default("auto"),
  kbValue: z.string().max(80).default(""),
  kbLimit: z.number().int().min(1).max(12).default(6),
  items: z
    .array(z.object({ q: z.string().max(200).default(""), a: z.string().max(2000).default("") }))
    .max(30)
    .default([]),
});

type KbItem = { q: string; a: string };

/** What the page is about, when nobody said. */
function autoFilter(ctx: RenderCtx) {
  const entity = ctx.entity;
  if (entity?.type === "concern") return { concernSlug: entity.slug };
  if (ctx.kind === "brand") return { brandSlug: ctx.slug };
  if (entity?.type === "product") {
    // The brand and the concerns come from the catalogue, not from the
    // entity: EntityRef carries a slug and a name, and widening it would mean
    // changing every route that builds one so that this section can ask one
    // extra question.
    const product = getProductBySlug(entity.slug);
    return {
      productSlug: entity.slug,
      brandSlug: product?.brand ?? null,
      productConcerns: product?.concerns ?? [],
    };
  }
  // Nothing to be about: the questions everyone asks, which is what /help
  // and a plain page want.
  return { topic: "ordering-support", pinnedOnly: true };
}

async function load(settings: z.output<typeof schema>, ctx: RenderCtx): Promise<KbItem[]> {
  if (settings.source !== "kb") return [];

  const picked =
    settings.kbMode === "topic"
      ? { topic: settings.kbValue || null }
      : settings.kbMode === "concern"
        ? { concernSlug: settings.kbValue || null }
        : settings.kbMode === "brand"
          ? { brandSlug: settings.kbValue || null }
          : settings.kbMode === "pinned"
            ? { pinnedOnly: true }
            : autoFilter(ctx);

  const articles = await faqForContext({ ...picked, limit: settings.kbLimit });
  return articles.map((a) => ({
    q: a.title,
    // The whole answer. It used to be the first paragraph plus a "read the
    // full answer" link through to /faq/<slug>; with that link gone, a first
    // paragraph on its own would be a truncated answer and no way to reach
    // the rest. Most of these answers are one paragraph anyway.
    a: answerParagraphs(a.content).join("\n\n") || a.content,
  }));
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, KbItem[]>) {
  // One shape for all three sources, so the markup below does not have to
  // ask which one it got.
  const items: KbItem[] =
    settings.source === "kb"
      ? (data ?? [])
      : (settings.source === "help" ? helpFaqs : settings.items).map((i) => ({ q: i.q, a: i.a }));

  const shown = items.filter((i) => i.q && i.a);
  if (shown.length === 0) return null;

  return (
    // A rule above the heading: this section is dropped straight under
    // whatever the page already had, and with nothing between them the
    // questions read as a continuation of the block above rather than as
    // their own part of the page.
    <section className="container-page pb-8 md:pb-10">
      <div className="border-t border-surface-line pt-7 md:pt-8">
        {settings.heading && <h2 className="mb-4 font-bold text-brand-ink">{settings.heading}</h2>}
        {/* <details> rather than the click handler the site used before: it is
            the same accordion with no JavaScript at all, `name` gives the
            one-open-at-a-time behaviour natively, and the first one starts
            open exactly as it did. */}
        <div className="flex flex-col gap-2">
          {shown.map((item, i) => (
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
              {/* whitespace-pre-line: the answer may be several paragraphs and
                  they are joined with blank lines, not wrapped in <p>. */}
              <div className="whitespace-pre-line px-4 pb-4 text-sm leading-relaxed text-slate-600">
                {item.a}
              </div>
            </details>
          ))}
        </div>
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
    kbMode: "auto",
    kbValue: "",
    kbLimit: 6,
    items: [],
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    {
      key: "source",
      type: "select",
      label: "ดึงคำถามจาก",
      options: [
        ["kb", "ศูนย์คำถาม (แนะนำ)"],
        ["help", "ชุดคำถามกลางของศูนย์ช่วยเหลือ"],
        ["manual", "พิมพ์เองเฉพาะหน้านี้"],
      ],
      help: "เลือกชุดกลางแล้วแก้ที่เดียวจะเปลี่ยนทุกหน้าที่ใช้",
    },
    {
      key: "kbMode",
      type: "select",
      label: "เลือกคำถามจากศูนย์คำถามแบบไหน",
      options: [
        ["auto", "ให้ระบบดูจากหน้านี้เอง"],
        ["topic", "ตามหัวข้อ"],
        ["concern", "ตามปัญหา"],
        ["brand", "ตามแบรนด์"],
        ["pinned", "เฉพาะข้อที่ปักหมุด"],
      ],
      help: "แบบอัตโนมัติ: หน้าปัญหาผิวดึงตามปัญหานั้น หน้าแบรนด์ดึงตามแบรนด์ หน้าสินค้าไล่จากสินค้า → แบรนด์ → ปัญหาของสินค้า",
    },
    { key: "kbValue", type: "text", label: "slug ของหัวข้อ/ปัญหา/แบรนด์", placeholder: "เช่น oral-care" },
    {
      key: "items",
      type: "list",
      label: "คำถาม (เฉพาะโหมดพิมพ์เอง)",
      item: "คำถาม",
      max: 30,
      columns: [
        { key: "q", label: "คำถาม" },
        { key: "a", label: "คำตอบ", type: "textarea" },
      ],
    },
  ],
  enabledOn: ["page", "campaign", "system", "template"],
  load,
  Component,
};

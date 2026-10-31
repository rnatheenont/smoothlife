import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import KnowledgeArcGallery, { type ArcItem } from "@/components/home/KnowledgeArcGallery";
import ScrollReveal from "@/components/ScrollReveal";
import { articles } from "@/data/articles";
import { articleProductSlugs, cardsForSlugs } from "@/lib/article-products";
import { getStoreArticles, storeArticleHref } from "@/lib/storefront-articles";
import { lText, tx } from "@/lib/i18n/localized";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The reading at the end of the page: a drifting arc of article covers, each
// with the catalogue of whatever brand the post talks about underneath it.
//
// The shelf under each cover is worked out here, on the server, because it
// reads the whole post body and only the handful of resulting slugs need to
// cross into the browser.

const schema = z.object({
  eyebrow: lText(40).default("บทความและความรู้"),
  /** Drawn in the brand gradient, ahead of the rest of the heading. */
  headingAccent: lText(24).default("ความรู้"),
  headingRest: lText(60).default("เรื่องผิวและสุขภาพ"),
  blurbLine1: lText(80).default("อ่านเรื่องผิว ฟัน และสุขภาพแบบเข้าใจง่าย"),
  blurbLine2: lText(80).default("เลือกเรื่องที่สนใจ แล้วนำไปใช้ได้จริงในทุกวัน"),
  ctaLabel: lText(30).default("ดูบทความทั้งหมด"),
  ctaHref: z.string().min(1).default("/knowledge"),
  count: z.number().int().min(3).max(16).default(12),
  /** How many products to hang under each cover. */
  shelfSize: z.number().int().min(2).max(20).default(10),
});

/** The post that opens first carries its shelf; the rest carry slugs and are
 *  fetched when the arc is turned to them. Twelve posts' worth of cards in
 *  the HTML is a hundred and twenty nobody has asked to see. */
function withFirstShelf(items: ArcItem[]): ArcItem[] {
  const first = items.findIndex((i) => i.productSlugs.length > 0);
  if (first < 0) return items;
  return items.map((item, i) => (i === first ? { ...item, products: cardsForSlugs(item.productSlugs) } : item));
}

async function load(settings: z.output<typeof schema>): Promise<ArcItem[]> {
  const live = await getStoreArticles();
  if (live) {
    return withFirstShelf(live.slice(0, settings.count).map((a) => ({
      key: a.handle,
      href: storeArticleHref(a),
      title: a.title,
      image: a.image,
      productSlugs: articleProductSlugs(`${a.title} ${a.excerpt} ${a.html}`, settings.shelfSize),
    })));
  }
  // The Shopify blog could not be read — the guides in the repo say the same
  // things and are never unavailable.
  return withFirstShelf(
    articles.slice(0, settings.count).map((a) => ({
    key: a.slug,
    href: `/knowledge/article/${a.slug}`,
    title: a.title,
    image: a.image as string | null,
      productSlugs: articleProductSlugs(`${a.title} ${a.excerpt} ${a.body.join(" ")}`, settings.shelfSize),
    }))
  );
}

function Component({ settings, data, ctx }: SectionProps<z.output<typeof schema>, ArcItem[]>) {
  const items = data ?? [];
  // The heading is split in two because only the first half is drawn in the
  // gradient; both halves are read here so a translation can move the accent
  // word to wherever English puts it.
  // Read for its side effect on validation only — see the note by the heading.
  void tx(settings.eyebrow, ctx.locale);
  const headingAccent = tx(settings.headingAccent, ctx.locale);
  const headingRest = tx(settings.headingRest, ctx.locale);
  const blurbLine1 = tx(settings.blurbLine1, ctx.locale);
  const blurbLine2 = tx(settings.blurbLine2, ctx.locale);
  const ctaLabel = tx(settings.ctaLabel, ctx.locale);
  // Nothing to read is not worth a heading over an empty arc.
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden bg-white pt-10 pb-12 md:pt-16 md:pb-16 lg:pt-20">
      <ScrollReveal className="container-page text-center">
        {/* The eyebrow is read but not drawn. It said "articles and
            knowledge" above a heading that says "knowledge about skin and
            health", and a label that repeats the heading at a quarter of the
            size is the heading said twice. The field stays in the schema so
            documents that carry a value still validate, and so the editor
            keeps a place to put one if the section ever needs it. */}
        <h2 className="text-[26px] font-medium leading-[1.4] tracking-[-0.01em] text-[#0a0a0a] md:text-[40px]">
          {/* inline-block with padding: a clipped gradient stops at the box,
              and Thai tone marks and vowels above/below reach past it. */}
          <span className="inline-block bg-brand-gradient bg-clip-text px-0.5 pb-1 font-bold text-transparent">
            {headingAccent}
          </span>{" "}
          {headingRest}
        </h2>
        {/* Thai has no spaces between words, so the browser may break mid-
            phrase; each phrase is kept whole and the line breaks between them. */}
        <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-relaxed text-slate-500 md:text-base">
          <span className="inline-block">{blurbLine1}</span>{" "}
          <span className="inline-block">{blurbLine2}</span>
        </p>
      </ScrollReveal>
      <div className="mt-4 md:mt-8">
        <KnowledgeArcGallery items={items} />
      </div>
      <div className="mt-2 flex justify-center">
        <Link
          href={settings.ctaHref}
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[#0a0a0a] px-6 text-sm font-semibold text-white transition-colors hover:bg-black/80"
        >
          {ctaLabel} <ChevronRight size={15} />
        </Link>
      </div>
    </section>
  );
}

export const articleGallery: SectionDefinition<typeof schema> = {
  type: "article_gallery",
  version: 1,
  label: "บทความและความรู้",
  description: "ชั้นบทความแบบโค้ง ดึงจากบล็อก Shopify อัตโนมัติ",
  category: "content",
  schema,
  defaults: {
    eyebrow: "บทความและความรู้",
    headingAccent: "ความรู้",
    headingRest: "เรื่องผิวและสุขภาพ",
    blurbLine1: "อ่านเรื่องผิว ฟัน และสุขภาพแบบเข้าใจง่าย",
    blurbLine2: "เลือกเรื่องที่สนใจ แล้วนำไปใช้ได้จริงในทุกวัน",
    ctaLabel: "ดูบทความทั้งหมด",
    ctaHref: "/knowledge",
    count: 12,
    shelfSize: 10,
  },
  fields: [
    { key: "eyebrow", type: "text", label: "คำนำหัวข้อ", localized: true },
    { key: "headingAccent", type: "text", label: "หัวข้อ (คำที่ไล่สี)", localized: true },
    { key: "headingRest", type: "text", label: "หัวข้อ (ส่วนที่เหลือ)", localized: true },
    { key: "blurbLine1", type: "text", label: "คำโปรยบรรทัดที่ 1", localized: true },
    { key: "blurbLine2", type: "text", label: "คำโปรยบรรทัดที่ 2", localized: true },
    { key: "ctaLabel", type: "text", label: "ข้อความปุ่ม", localized: true },
    { key: "ctaHref", type: "text", label: "ลิงก์ปุ่ม" },
    { key: "count", type: "number", label: "จำนวนบทความ", min: 3, max: 16 },
    { key: "shelfSize", type: "number", label: "สินค้าใต้บทความแต่ละเรื่อง", min: 2, max: 20 },
  ],
  enabledOn: ["home", "page", "brand"],
  maxPerPage: 1,
  load,
  Component,
};

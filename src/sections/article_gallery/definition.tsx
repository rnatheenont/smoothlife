import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import KnowledgeArcGallery, { type ArcItem } from "@/components/home/KnowledgeArcGallery";
import ScrollReveal from "@/components/ScrollReveal";
import { articles } from "@/data/articles";
import { articleProductSlugs, cardsForSlugs } from "@/lib/article-products";
import { getStoreArticles, storeArticleHref } from "@/lib/storefront-articles";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The reading at the end of the page: a drifting arc of article covers, each
// with the catalogue of whatever brand the post talks about underneath it.
//
// The shelf under each cover is worked out here, on the server, because it
// reads the whole post body and only the handful of resulting slugs need to
// cross into the browser.

const schema = z.object({
  eyebrow: z.string().max(40).default("บทความและความรู้"),
  /** Drawn in the brand gradient, ahead of the rest of the heading. */
  headingAccent: z.string().max(24).default("ความรู้"),
  headingRest: z.string().max(60).default("เรื่องผิวและสุขภาพ"),
  blurbLine1: z.string().max(80).default("อ่านเรื่องผิว ฟัน และสุขภาพแบบเข้าใจง่าย"),
  blurbLine2: z.string().max(80).default("เลือกเรื่องที่สนใจ แล้วนำไปใช้ได้จริงในทุกวัน"),
  ctaLabel: z.string().max(30).default("ดูบทความทั้งหมด"),
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

function Component({ settings, data }: SectionProps<z.output<typeof schema>, ArcItem[]>) {
  const items = data ?? [];
  // Nothing to read is not worth a heading over an empty arc.
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden bg-white pt-10 pb-12 md:pt-16 md:pb-16 lg:pt-20">
      <ScrollReveal className="container-page text-center">
        <p className="text-[13px] font-medium tracking-[0.04em] text-slate-500">{settings.eyebrow}</p>
        <h2 className="mt-2 text-[26px] font-medium leading-[1.4] tracking-[-0.01em] text-[#0a0a0a] md:text-[40px]">
          {/* inline-block with padding: a clipped gradient stops at the box,
              and Thai tone marks and vowels above/below reach past it. */}
          <span className="inline-block bg-brand-gradient bg-clip-text px-0.5 pb-1 font-bold text-transparent">
            {settings.headingAccent}
          </span>{" "}
          {settings.headingRest}
        </h2>
        {/* Thai has no spaces between words, so the browser may break mid-
            phrase; each phrase is kept whole and the line breaks between them. */}
        <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-relaxed text-slate-500 md:text-base">
          <span className="inline-block">{settings.blurbLine1}</span>{" "}
          <span className="inline-block">{settings.blurbLine2}</span>
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
          {settings.ctaLabel} <ChevronRight size={15} />
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
    { key: "eyebrow", type: "text", label: "คำนำหัวข้อ" },
    { key: "headingAccent", type: "text", label: "หัวข้อ (คำที่ไล่สี)" },
    { key: "headingRest", type: "text", label: "หัวข้อ (ส่วนที่เหลือ)" },
    { key: "blurbLine1", type: "text", label: "คำโปรยบรรทัดที่ 1" },
    { key: "blurbLine2", type: "text", label: "คำโปรยบรรทัดที่ 2" },
    { key: "ctaLabel", type: "text", label: "ข้อความปุ่ม" },
    { key: "ctaHref", type: "text", label: "ลิงก์ปุ่ม" },
    { key: "count", type: "number", label: "จำนวนบทความ", min: 3, max: 16 },
    { key: "shelfSize", type: "number", label: "สินค้าใต้บทความแต่ละเรื่อง", min: 2, max: 20 },
  ],
  enabledOn: ["home", "page", "brand"],
  maxPerPage: 1,
  load,
  Component,
};

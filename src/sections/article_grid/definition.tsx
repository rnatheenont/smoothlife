import { z } from "zod";
import ArticleGrid from "@/components/ArticleGrid";
import { articles } from "@/data/articles";
import { getStoreArticles, thaiDate } from "@/lib/storefront-articles";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// A grid of articles, from wherever the shop keeps them.
//
// Two sources, and they are genuinely different things rather than a setting
// for its own sake: the guides written for this site live in the repo and are
// filed by category, while the blog posts live in Shopify and arrive newest
// first. The knowledge pages show both, in that order, which is why a page
// can hold more than one of these.
//
// The heading belongs to the grid rather than sitting above it as its own
// block, because a grid with nothing in it should take its heading with it
// when it goes — a lone "บทความล่าสุด" over empty space reads as a page that
// failed rather than a shop that has not blogged this week.

const schema = z.object({
  heading: z.string().max(120).default(""),
  headingSize: z.enum(["base", "lg"]).default("base"),
  source: z.enum(["shopify", "static"]).default("static"),
  /** Static source only: which kind of guide. Empty means every kind. */
  category: z.enum(["", "guide", "ingredient", "routine", "video", "qa"]).default(""),
  limit: z.number().int().min(1).max(24).default(24),
  /**
   * How much room under the grid.
   *
   * "end" is the last block on the page and carries the page's own bottom
   * padding; "between" is a grid with more page under it. The distinction has
   * to live somewhere, and the section knows its own content better than the
   * renderer does — see the note in page_header about the last section
   * owning the bottom of the page.
   */
  room: z.enum(["end", "between"]).default("end"),
});

const ROOM: Record<string, string> = { end: "pb-8 md:pb-10", between: "pb-10" };
const HEADING: Record<string, string> = {
  base: "mb-4 font-bold text-brand-ink",
  lg: "mb-4 text-lg font-bold text-brand-ink md:text-xl",
};

type Item = {
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  readMins: number;
  date?: string;
};

async function load(settings: z.output<typeof schema>): Promise<Item[]> {
  if (settings.source === "shopify") {
    const posts = (await getStoreArticles()) ?? [];
    return posts.slice(0, settings.limit).map((p) => ({
      // Encoded here rather than in the grid: a Shopify handle may carry
      // characters that are legal in a handle and not in a path segment.
      slug: encodeURIComponent(p.handle),
      title: p.title,
      excerpt: p.excerpt,
      image: p.image,
      readMins: p.readMins,
      date: thaiDate(p.publishedAt),
    }));
  }
  const picked = settings.category ? articles.filter((a) => a.category === settings.category) : articles;
  return picked.slice(0, settings.limit);
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Item[]>) {
  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <section className={`container-page ${ROOM[settings.room] ?? ROOM.end}`}>
      {settings.heading && <h2 className={HEADING[settings.headingSize] ?? HEADING.base}>{settings.heading}</h2>}
      <ArticleGrid articles={items} />
    </section>
  );
}

export const articleGrid: SectionDefinition<typeof schema> = {
  type: "article_grid",
  version: 1,
  label: "ตารางบทความ",
  description: "การ์ดบทความ จากคู่มือในเว็บหรือจากบล็อก Shopify",
  category: "content",
  schema,
  defaults: { heading: "", headingSize: "base", source: "static", category: "", limit: 24, room: "end" },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ (ไม่ใส่ก็ได้)" },
    {
      key: "headingSize",
      type: "select",
      label: "ขนาดหัวข้อ",
      options: [
        ["base", "ปกติ"],
        ["lg", "ใหญ่"],
      ],
    },
    {
      key: "source",
      type: "select",
      label: "ดึงบทความจาก",
      options: [
        ["static", "คู่มือในเว็บ"],
        ["shopify", "บล็อก Shopify (ใหม่สุดก่อน)"],
      ],
    },
    {
      key: "category",
      type: "select",
      label: "ประเภท (เฉพาะคู่มือในเว็บ)",
      options: [
        ["", "ทุกประเภท"],
        ["guide", "คู่มือทั่วไป"],
        ["ingredient", "ส่วนผสม"],
        ["routine", "รูทีน"],
        ["video", "วิดีโอ"],
        ["qa", "ถาม-ตอบ"],
      ],
    },
    { key: "limit", type: "number", label: "จำนวนสูงสุด", min: 1, max: 24 },
    {
      key: "room",
      type: "select",
      label: "ระยะใต้ตาราง",
      options: [
        ["end", "บล็อกสุดท้ายของหน้า"],
        ["between", "มีเนื้อหาต่อด้านล่าง"],
      ],
    },
  ],
  enabledOn: ["page", "system", "template"],
  load,
  Component,
};

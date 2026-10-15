import { z } from "zod";
import ArticleView, { ARTICLE_RAIL_DEFAULT, type ArticleRail } from "@/components/knowledge/ArticleView";
import { getArticleBySlug } from "@/data/articles";
import type { Article } from "@/data/types";
import { getStoreArticle, getStoreArticles, type StoreArticle } from "@/lib/storefront-articles";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// One article, whole.
//
// Locked, because the page is a two-column grid whose right-hand rail is
// sticky, and a sticky element can only travel inside its own parent: cut the
// rail off into a section of its own and it stops following the reader after
// the height of the rail. Same reason /shop's category row shares a block
// with the grid it sits over.
//
// So what moving this page into the system buys is not rearranging it — it is
// the words in the rail, which until now were four sentences typed into the
// layout, and the ability to put a block above or below the article.

const schema = z.object({
  othersHeading: z.string().max(80).default(""),
  othersCtaLabel: z.string().max(80).default(""),
  othersCtaHref: z.string().default(""),
  advisorTitle: z.string().max(120).default(""),
  advisorBody: z.string().max(240).default(""),
  advisorCtaLabel: z.string().max(80).default(""),
  advisorCtaHref: z.string().default(""),
  /** How many other posts the rail offers. */
  othersCount: z.number().int().min(1).max(8).default(4),
});

type Data = { guide: Article | null; post: StoreArticle | null; others: StoreArticle[] };

async function load(
  settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; handle?: string } }
): Promise<Data | null> {
  const handle = ctx.entity?.handle;
  if (!handle) return null;

  // A written guide first, a Shopify post second — the same order the route
  // uses to decide whether this address is a page at all.
  const guide = getArticleBySlug(handle) ?? null;
  const post = guide ? null : await getStoreArticle(handle);
  if (!guide && !post) return null;

  const others = ((await getStoreArticles()) ?? [])
    .filter((a) => a.handle !== post?.handle)
    .slice(0, settings.othersCount);
  return { guide, post, others };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  // An empty field falls back to the words the page was written with rather
  // than printing nothing: a rail with a blank heading over a list of posts
  // is worse than the heading nobody got round to changing.
  const rail: ArticleRail = {
    othersHeading: settings.othersHeading || ARTICLE_RAIL_DEFAULT.othersHeading,
    othersCtaLabel: settings.othersCtaLabel || ARTICLE_RAIL_DEFAULT.othersCtaLabel,
    othersCtaHref: settings.othersCtaHref || ARTICLE_RAIL_DEFAULT.othersCtaHref,
    advisorTitle: settings.advisorTitle || ARTICLE_RAIL_DEFAULT.advisorTitle,
    advisorBody: settings.advisorBody || ARTICLE_RAIL_DEFAULT.advisorBody,
    advisorCtaLabel: settings.advisorCtaLabel || ARTICLE_RAIL_DEFAULT.advisorCtaLabel,
    advisorCtaHref: settings.advisorCtaHref || ARTICLE_RAIL_DEFAULT.advisorCtaHref,
  };

  return (
    <section className="container-page py-6 md:py-10">
      <ArticleView guide={data.guide} post={data.post} others={data.others} rail={rail} />
    </section>
  );
}

export const articlePage: SectionDefinition<typeof schema> = {
  type: "article_page",
  version: 1,
  label: "ตัวบทความ",
  description: "หัวข้อ เนื้อเรื่อง และแถบข้างของบทความที่หน้านี้แสดง — แก้ได้เฉพาะคำในแถบข้าง",
  category: "content",
  schema,
  defaults: { ...ARTICLE_RAIL_DEFAULT, othersCount: 4 },
  fields: [
    { key: "othersHeading", type: "text", label: "หัวข้อกลุ่มบทความอื่น" },
    { key: "othersCount", type: "number", label: "จำนวนบทความอื่น", min: 1, max: 8 },
    { key: "othersCtaLabel", type: "text", label: "ข้อความลิงก์ดูทั้งหมด" },
    { key: "othersCtaHref", type: "text", label: "ลิงก์ดูทั้งหมด" },
    { key: "advisorTitle", type: "text", label: "หัวข้อการ์ดที่ปรึกษา" },
    { key: "advisorBody", type: "textarea", label: "คำอธิบายการ์ดที่ปรึกษา" },
    { key: "advisorCtaLabel", type: "text", label: "ข้อความปุ่ม" },
    { key: "advisorCtaHref", type: "text", label: "ลิงก์ปุ่ม" },
  ],
  enabledOn: ["template"],
  requiresEntity: ["article"],
  locked: true,
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  Component,
};

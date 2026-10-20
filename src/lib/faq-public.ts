import { supabaseConfigured, supabaseRestCached, pgValue } from "@/lib/supabase-server";
import { getProductBySlug } from "@/data/products";
import { toCardData, type ProductCardData } from "@/data/card";
import { excerptOf } from "@/lib/kb-public";

// The FAQ centre's reading side.
//
// Separate from kb-public.ts, which answers a narrower question — "which
// articles have a page?" — with the four columns that page needed. The FAQ
// centre needs the topic, the concerns, the keywords customers type, and the
// call to action, and it needs them for every published question at once so
// the browser can filter without going back to the server.
//
// Cached through supabaseRestCached with the `kb-public` tag, which the admin
// save routes already revalidate. Publishing an answer therefore reaches this
// page without anybody clearing anything.

export type FaqArticle = {
  id: string;
  public_slug: string;
  title: string;
  title_en: string | null;
  content: string;
  content_en: string | null;
  topic: string | null;
  concerns: string[] | null;
  brand_slugs: string[] | null;
  keywords: string[] | null;
  product_tags: string[] | null;
  cta_label: string | null;
  cta_label_en: string | null;
  cta_href: string | null;
  pinned: boolean | null;
  sort: number | null;
  helpful_count: number | null;
  updated_at: string;
};

export type FaqTopic = {
  slug: string;
  kind: "section" | "concern";
  label_th: string;
  label_en: string | null;
  icon: string | null;
  link_href: string | null;
  sort: number;
};

const ARTICLE_COLUMNS = [
  "id",
  "public_slug",
  "title",
  "title_en",
  "content",
  "content_en",
  "topic",
  "concerns",
  "brand_slugs",
  "keywords",
  "product_tags",
  "cta_label",
  "cta_label_en",
  "cta_href",
  "pinned",
  "sort",
  "helpful_count",
  "updated_at",
].join(",");

const TAG = "kb-public";
const REVALIDATE = 900;

/**
 * Every question with a page, in the order the page shows them: pinned first,
 * then the order the team set, then the ones readers found most helpful.
 *
 * `visibility` matters as much as `status` here. An article can be approved
 * for the assistant to quote without being written to be read by a stranger —
 * `ai_only` is that state — and this page is the stranger.
 */
export async function getFaqArticles(): Promise<FaqArticle[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRestCached<FaqArticle[]>(
      `kb_articles?status=eq.published&visibility=eq.public&public_slug=not.is.null` +
        `&select=${ARTICLE_COLUMNS}&order=pinned.desc.nullslast,sort.asc.nullslast,helpful_count.desc.nullslast,updated_at.desc&limit=500`,
      { revalidate: REVALIDATE, tags: [TAG] }
    );
  } catch {
    // An empty FAQ centre is a thin page; a crashed one is a 500 on a route
    // Google is being asked to index.
    return [];
  }
}

export async function getFaqArticle(slug: string): Promise<FaqArticle | null> {
  if (!supabaseConfigured()) return null;
  try {
    const rows = await supabaseRestCached<FaqArticle[]>(
      `kb_articles?status=eq.published&visibility=eq.public&public_slug=eq.${pgValue(slug)}&select=${ARTICLE_COLUMNS}&limit=1`,
      { revalidate: REVALIDATE, tags: [TAG, `kb-public:${slug}`] }
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export type RelatedFaq = { id: string; public_slug: string; title: string; score: number };

/**
 * Questions near this one, by meaning when the embeddings are there and by
 * the concerns the team filed them under when they are not — see the
 * `kb_related` function for why the fallback is the half that matters today.
 */
export async function getRelatedFaq(articleId: string, limit = 4): Promise<RelatedFaq[]> {
  if (!supabaseConfigured()) return [];
  try {
    const rows = await supabaseRestCached<RelatedFaq[]>(
      `rpc/kb_related?p_article_id=${encodeURIComponent(articleId)}&p_limit=${limit}`,
      { revalidate: REVALIDATE, tags: [TAG] }
    );
    return (rows ?? []).filter((r) => r.public_slug).map((r) => ({ ...r, score: Number(r.score) }));
  } catch {
    return [];
  }
}

/** The tabs and chips, as the team ordered them in the admin. */
export async function getFaqTopics(): Promise<FaqTopic[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRestCached<FaqTopic[]>(
      "faq_topics?enabled=is.true&select=slug,kind,label_th,label_en,icon,link_href,sort&order=sort.asc,slug.asc",
      { revalidate: REVALIDATE, tags: [TAG] }
    );
  } catch {
    return [];
  }
}

/**
 * What the browser needs to filter and score, and nothing else.
 *
 * This is inlined into the page's HTML, so every field is one a keystroke
 * actually uses. The answer arrives as a 160-character excerpt: a question
 * whose match is only in the fifth paragraph of the answer is not the one to
 * put first, and shipping the full answers twice — once as readable HTML,
 * once as JSON — would double the page for nothing.
 *
 * The keys are spelled out rather than shortened to one letter. Repeated key
 * names are the single most compressible thing in a JSON array, so the bytes
 * on the wire are nearly identical, and `item.topic` can be read six months
 * from now.
 */
export type FaqIndexItem = {
  slug: string;
  title: string;
  title_en: string | null;
  keywords: string[];
  excerpt: string;
  topic: string | null;
  concerns: string[];
  brands: string[];
  pinned: boolean;
};

export function faqSearchIndex(articles: FaqArticle[]): FaqIndexItem[] {
  return articles.map((a) => ({
    slug: a.public_slug,
    title: a.title,
    title_en: a.title_en,
    keywords: a.keywords ?? [],
    excerpt: excerptOf(a.content, 160),
    topic: a.topic,
    concerns: a.concerns ?? [],
    brands: a.brand_slugs ?? [],
    pinned: Boolean(a.pinned),
  }));
}

/**
 * The products an answer points at, as cards.
 *
 * Hidden and sold-out products are dropped, the same rule the product search
 * follows: an answer that recommends something nobody can buy sends the
 * reader to a dead end, and the answer still works without the card because
 * the call to action is separate. A tag can also outlive the product it named,
 * so a missing slug is normal rather than an error.
 */
export function faqProductCards(tags: string[] | null | undefined): ProductCardData[] {
  return (tags ?? [])
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && Boolean(p?.inStock))
    .map(toCardData);
}

/**
 * The answer split into paragraphs, for rendering.
 *
 * The answers are prose with blank lines between blocks, written by people in
 * a form field. Rendering them as a single block loses the structure the
 * writer put there; rendering them as HTML would mean trusting a text column.
 */
export function answerParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

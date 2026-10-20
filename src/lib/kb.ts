// The knowledge base the chat assistant answers from (see the
// ai-knowledge-base plan). Server-only: every read and write goes through the
// service role, like the rest of the tables here.
//
// Two things are deliberate. Articles are chunked on save rather than on
// read, so retrieval is a single query; and embeddings are optional — with no
// embedding provider configured the same chunks are searched by trigram
// similarity, so the assistant can answer from approved articles today and
// answer better once a key exists, without a migration in between.
import { pgValue, supabaseRest } from "@/lib/supabase-server";

export type KbStatus = "draft" | "published" | "needs_review" | "archived";
export type KbCategory = "faq" | "policy" | "product" | "ingredient" | "loyalty" | "shipping" | "payment";
// "shopify_sync" is gone: the catalogue used to be copied in as one article
// per product, and the assistant now reads a product's own page content
// through get_product_details instead of a second copy of it.
export type KbSource = "manual" | "chat_promoted" | "import";
export type KbVisibility = "public" | "ai_only";

export type KbArticle = {
  id: string;
  source: KbSource;
  category: KbCategory;
  title: string;
  content: string;
  product_tags: string[];
  status: KbStatus;
  last_reviewed_at: string | null;
  reviewed_by: string | null;
  source_ref: string | null;
  /** Set only when someone has chosen to publish this as a public page at
   *  /faq/<slug>. Null means the article is for the assistant
   *  to quote, not for a reader to land on — see the column comment. */
  public_slug: string | null;
  created_at: string;
  updated_at: string;

  // The FAQ fields (see the faq-center plan §3). Optional on the type because
  // the nineteen articles that predate them have none, and a route that only
  // selects KB_COLUMNS should keep working either way.
  title_en?: string | null;
  content_en?: string | null;
  keywords?: string[] | null;
  topic?: string | null;
  concerns?: string[] | null;
  brand_slugs?: string[] | null;
  visibility?: KbVisibility;
};

export const KB_COLUMNS =
  "id,source,category,title,content,product_tags,status,last_reviewed_at,reviewed_by,source_ref,public_slug,created_at,updated_at," +
  // Selected everywhere KB_COLUMNS is, so that any route which saves an
  // article reindexes it with its question in both languages and its search
  // words — rather than quietly indexing the Thai half on its own.
  "title_en,content_en,keywords,topic,concerns,brand_slugs,visibility";

/**
 * The columns `articleChunks` reads, as a select list.
 *
 * Exists because selecting fewer of them does not fail — it silently indexes
 * a worse article. `ChunkableArticle` has to keep the FAQ fields optional,
 * since the articles written before the FAQ centre genuinely have none, which
 * means `{ id, title, content }` type-checks as something chunkable and then
 * takes the plain-prose path: no search words, no English, no topic.
 *
 * That is exactly what happened to the reindex route. It selected three
 * columns, and reindexing twenty-one published answers rebuilt every one of
 * them without the `คำค้น:` line that makes "หน้ามัน" findable, and dropped
 * their English chunk altogether. Nothing failed; the index just got quieter.
 *
 * Any route that rebuilds chunks selects this (or KB_COLUMNS, which contains
 * it). `reindex-columns.test.ts` checks that they all do.
 */
export const CHUNK_COLUMNS = "id,title,content,title_en,content_en,keywords,topic,concerns,brand_slugs";

export const CATEGORY_TH: Record<KbCategory, string> = {
  faq: "คำถามที่พบบ่อย",
  policy: "นโยบายร้าน",
  product: "ข้อมูลสินค้า",
  ingredient: "ส่วนผสม",
  loyalty: "สมาชิก & คะแนน",
  shipping: "การจัดส่ง",
  payment: "การชำระเงิน",
};

export const STATUS_TH: Record<KbStatus, string> = {
  draft: "ฉบับร่าง",
  published: "เผยแพร่แล้ว",
  needs_review: "ต้องรีวิว",
  archived: "เก็บเข้าคลัง",
};

const CATEGORIES = Object.keys(CATEGORY_TH) as KbCategory[];
const STATUSES = Object.keys(STATUS_TH) as KbStatus[];

/** What the admin form may send. Returns the row to write, or a Thai error. */
export function parseArticleInput(body: unknown): { row: Partial<KbArticle> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "ข้อมูลไม่ถูกต้อง" };
  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title || title.length > 200) return { error: "กรุณาใส่หัวข้อ (ไม่เกิน 200 ตัวอักษร)" };

  const content = typeof b.content === "string" ? b.content.trim() : "";
  if (!content) return { error: "กรุณาใส่เนื้อหาความรู้" };
  if (content.length > 20000) return { error: "เนื้อหายาวเกินไป (ไม่เกิน 20,000 ตัวอักษร)" };

  const category = CATEGORIES.includes(b.category as KbCategory) ? (b.category as KbCategory) : null;
  if (!category) return { error: "หมวดหมู่ไม่ถูกต้อง" };

  const status = STATUSES.includes(b.status as KbStatus) ? (b.status as KbStatus) : "draft";

  const tags = Array.isArray(b.product_tags)
    ? [...new Set(b.product_tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim().slice(0, 120)))].slice(0, 30)
    : [];

  // A public page is its own decision, separate from publishing: an article
  // the assistant may quote is often written about customers rather than to
  // them, and only a person can judge whether the wording reads right on a
  // page a stranger lands on. Blank clears the page; an unpublished article
  // never has one, whatever is typed here.
  const rawSlug = typeof b.public_slug === "string" ? b.public_slug.trim() : "";
  const publicSlug = status === "published" && rawSlug ? rawSlug.slice(0, 120) : null;

  return {
    row: {
      title,
      content,
      category,
      status,
      product_tags: tags,
      public_slug: publicSlug,
      // Publishing is the moment a person vouched for it.
      ...(status === "published" ? { last_reviewed_at: new Date().toISOString(), reviewed_by: "admin" } : {}),
    },
  };
}

/**
 * Split an article for retrieval: paragraphs, glued together until a chunk is
 * big enough to stand on its own but small enough to quote back.
 */
export function chunk(content: string, target = 700): string[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > target) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks.slice(0, 40) : [content.slice(0, target)];
}

/**
 * The score below which a match is not worth showing.
 *
 * There used to be two of these and only one of them worked: kb_search cut at
 * 0.42 in SQL, and KB_MIN_SCORE in the chat tool cut at 0.35 — which never
 * bit, because the rows below 0.42 had already been thrown away before they
 * reached it. Tuning the TS number did nothing and nobody could see why.
 *
 * One number now, sent to the function as p_min_score. 0.42 keeps today's
 * behaviour; it is a knob rather than a discovery.
 */
export const KB_MIN_SCORE = 0.42;

/** What a topic, concern or brand slug reads as inside a chunk. */
type ChunkableArticle = Pick<KbArticle, "title" | "content"> &
  Partial<Pick<KbArticle, "title_en" | "content_en" | "keywords" | "topic" | "concerns" | "brand_slugs">>;

/**
 * What the assistant sees for one article.
 *
 * An FAQ is not prose, and chunking it as prose loses the half that makes it
 * findable. A customer types "หน้ามัน" — which appears in the search words of
 * the article about oily, acne-prone skin and nowhere in its title or its
 * answer. Embedding only the answer means the question nobody can match is
 * the one the shop was asked most.
 *
 * So the first chunk carries the question in both languages, the search
 * words, and what the article is filed under, before the answer. Voyage
 * embeds the whole thing, which is also why a question asked in English finds
 * a Thai article: the model is multilingual and both languages sit in the
 * same chunk.
 *
 * The English answer goes in a chunk of its own rather than at the end of the
 * first: an English speaker should get an English answer quoted back, and a
 * chunk is the unit that gets quoted.
 *
 * An article with none of these fields — the nineteen that predate the FAQ
 * work — chunks exactly as it did before.
 */
export function articleChunks(article: ChunkableArticle): string[] {
  const keywords = (article.keywords ?? []).filter(Boolean);
  const concerns = (article.concerns ?? []).filter(Boolean);
  const brands = (article.brand_slugs ?? []).filter(Boolean);
  const hasFaqFields =
    Boolean(article.title_en || article.content_en) || keywords.length > 0 || Boolean(article.topic);

  if (!hasFaqFields) return chunk(`${article.title}\n\n${article.content}`);

  const filed = [
    article.topic ? `หัวข้อ: ${article.topic}` : "",
    concerns.length ? `ปัญหา: ${concerns.join(", ")}` : "",
    brands.length ? `แบรนด์: ${brands.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const head = [
    `คำถาม: ${article.title}`,
    article.title_en ? `Question: ${article.title_en}` : "",
    keywords.length ? `คำค้น: ${keywords.join(", ")}` : "",
    filed,
    `คำตอบ: ${article.content}`,
  ]
    .filter(Boolean)
    .join("\n");

  const chunks = chunk(head);
  if (article.content_en) chunks.push(...chunk(`Answer (EN): ${article.content_en}`));
  return chunks.slice(0, 40);
}

/** One request per this many texts, and per this much text. Voyage accepts
 *  more, but an account without a payment method is held to 10K tokens a
 *  minute — fewer, fuller requests are what fits through that. */
const EMBED_BATCH = 48;
const EMBED_CHARS = 6000;

/**
 * 429 on a free account means "too fast", not "too much". Indexing can wait
 * out the minute; a customer waiting on a reply cannot, so the search path
 * asks for no retries and falls back to text matching instead.
 */
async function voyage(texts: string[], key: string, retries: number, attempt = 0): Promise<number[][] | null> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.VOYAGE_MODEL || "voyage-3", input: texts, output_dimension: 1024 }),
  });

  if (res.status === 429 && attempt < retries) {
    // The free tier is 3 requests a minute; anything shorter just fails again.
    await new Promise((resolve) => setTimeout(resolve, 21_000));
    return voyage(texts, key, retries, attempt + 1);
  }
  if (!res.ok) {
    console.error("[kb] embedding failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return null;
  }

  const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  // The API may return them out of order; index is what says which is which.
  const ordered = new Array<number[]>(texts.length);
  for (const item of data.data) ordered[item.index ?? 0] = item.embedding;
  return ordered.every(Boolean) ? ordered : null;
}

/**
 * Voyage is Anthropic's recommended embedding provider; with no key the
 * chunks are stored without embeddings and searched as text instead.
 *
 * Texts go up in as few requests as the rate limit allows: the limit that
 * bites on a free account is requests per minute, so one request carrying
 * forty chunks is forty times cheaper than forty requests carrying one.
 */
export async function embed(texts: string[], { retries = 3 }: { retries?: number } = {}): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || texts.length === 0) return null;

  const groups: string[][] = [];
  let group: string[] = [];
  let chars = 0;
  for (const text of texts) {
    if (group.length > 0 && (group.length >= EMBED_BATCH || chars + text.length > EMBED_CHARS)) {
      groups.push(group);
      group = [];
      chars = 0;
    }
    group.push(text);
    chars += text.length;
  }
  if (group.length > 0) groups.push(group);

  try {
    const out: number[][] = [];
    for (const batch of groups) {
      const vectors = await voyage(batch, key, retries);
      if (!vectors) return null;
      out.push(...vectors);
    }
    return out;
  } catch (err) {
    console.error("[kb] embedding request failed", err);
    return null;
  }
}

/** Rewrite an article's chunks (and their embeddings, when available). */
export async function reindexArticle(article: Pick<KbArticle, "id"> & ChunkableArticle) {
  const pieces = articleChunks(article);
  const vectors = await embed(pieces);
  await supabaseRest(`kb_chunks?article_id=eq.${pgValue(article.id)}`, { method: "DELETE", returning: false });
  await supabaseRest("kb_chunks", {
    method: "POST",
    returning: false,
    body: JSON.stringify(
      pieces.map((text, i) => ({
        article_id: article.id,
        chunk_index: i,
        chunk_text: text,
        embedding: vectors ? JSON.stringify(vectors[i]) : null,
      }))
    ),
  });
  return { chunks: pieces.length, embedded: Boolean(vectors) };
}

/**
 * Reindex a batch of articles with as few embedding requests as possible:
 * every chunk of every article goes up together, then each article's chunks
 * are written back.
 */
export async function reindexArticles(articles: (Pick<KbArticle, "id"> & ChunkableArticle)[]) {
  const pieces = articles.map((a) => ({ id: a.id, chunks: articleChunks(a) }));
  const flat = pieces.flatMap((p) => p.chunks);
  const vectors = await embed(flat);

  let cursor = 0;
  for (const piece of pieces) {
    const slice = vectors ? vectors.slice(cursor, cursor + piece.chunks.length) : null;
    cursor += piece.chunks.length;
    await supabaseRest(`kb_chunks?article_id=eq.${pgValue(piece.id)}`, { method: "DELETE", returning: false });
    await supabaseRest("kb_chunks", {
      method: "POST",
      returning: false,
      body: JSON.stringify(
        piece.chunks.map((text, i) => ({
          article_id: piece.id,
          chunk_index: i,
          chunk_text: text,
          embedding: slice ? JSON.stringify(slice[i]) : null,
        }))
      ),
    });
  }
  return { articles: pieces.length, chunks: flat.length, embedded: Boolean(vectors) };
}

export type KbMatch = { article_id: string; chunk_id: string; title: string; category: KbCategory; chunk_text: string; score: number };

/** Top matches for a customer's question, published articles only. */
export async function searchKb(
  query: string,
  limit = 6,
  tags?: string[],
  minScore = KB_MIN_SCORE
): Promise<KbMatch[]> {
  // No waiting on a rate limit with a customer mid-question: if the embedding
  // does not come back at once, the search runs on text instead.
  const [vector] = (await embed([query], { retries: 0 })) ?? [];
  const rows = await supabaseRest<KbMatch[]>("rpc/kb_search", {
    method: "POST",
    body: JSON.stringify({
      p_query: query,
      p_embedding: vector ? JSON.stringify(vector) : null,
      p_limit: limit,
      p_tags: tags && tags.length > 0 ? tags : null,
      // Sent rather than left to the function's default, so the number lives
      // in one place in this codebase and not two.
      p_min_score: minScore,
    }),
  });
  return (rows ?? []).map((r) => ({ ...r, score: Number(r.score) }));
}

/** One tool call the assistant made, in the order it made it. */
export type AiToolCall = {
  round: number;
  name: string;
  query?: string;
  matched?: { id: string; score: number }[];
};

/**
 * What the assistant answered and which approved articles it used. Kept so a
 * claim in a transcript can be traced back to the article a person published
 * — and so the team can see what customers ask that the base cannot answer.
 *
 * Called on every turn, including the turns where the assistant never asked
 * the knowledge base. Those used to go unrecorded, which made the most
 * interesting failure invisible: an approved article exists, it scores
 * perfectly, and the model answers from the catalogue instead. `tools` is
 * what distinguishes "asked and found nothing" from "never asked".
 */
export async function logAiAnswer(entry: {
  uid?: string;
  question: string;
  answer: string;
  articleIds: string[];
  channel?: string;
  escalated?: boolean;
  tools?: AiToolCall[];
}) {
  try {
    await supabaseRest("ai_conversation_log", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        customer_id: entry.uid ?? null,
        channel: entry.channel ?? "web_chat",
        question: entry.question.slice(0, 2000),
        ai_answer: entry.answer.slice(0, 8000),
        matched_article_ids: [...new Set(entry.articleIds)],
        was_escalated: entry.escalated ?? false,
        tools: entry.tools ?? [],
      }),
    });
  } catch (err) {
    // Logging must never cost the customer their answer.
    console.error("[kb] logging the answer failed", err);
  }
}

/**
 * Articles whose chunks have no embedding yet — everything written before an
 * embedding provider was configured. Reindexing rewrites them with one, so the
 * search quietly upgrades itself instead of waiting for someone to press a
 * button in an admin screen they may never open.
 */
export async function backfillEmbeddings(budgetMs = 60_000): Promise<{ indexed: number; remaining: number }> {
  if (!process.env.VOYAGE_API_KEY) return { indexed: 0, remaining: 0 };

  // The team's own articles first, always. They are the ones customers
  // paraphrase ("ส่งของถึงมือกี่วัน" for "ใช้เวลาจัดส่งกี่วัน"). There used to
  // be two thousand catalogue chunks queued ahead of them; those are gone, so
  // what is left is only what a person wrote.
  const pending = await supabaseRest<{ article_id: string }[]>(
    "kb_chunks?embedding=is.null&select=article_id,kb_articles!inner(id)&kb_articles.status=eq.published&limit=3000"
  ).catch((): { article_id: string }[] => []);

  const ids = [...new Set(pending.map((c) => c.article_id))];
  if (ids.length === 0) return { indexed: 0, remaining: 0 };

  const started = Date.now();
  let indexed = 0;
  // Twenty at a time: one embedding request per round, which is what the
  // provider's per-minute limit actually counts.
  for (let i = 0; i < ids.length; i += 20) {
    if (Date.now() - started > budgetMs) break;
    const slice = ids.slice(i, i + 20);
    const articles = await supabaseRest<Pick<KbArticle, "id" | "title" | "content">[]>(
      `kb_articles?id=in.(${slice.map(pgValue).join(",")})&select=id,title,content`
    );
    const result = await reindexArticles(articles);
    if (!result.embedded) break; // rate-limited or down; tomorrow's run continues
    indexed += articles.length;
  }
  return { indexed, remaining: Math.max(0, ids.length - indexed) };
}

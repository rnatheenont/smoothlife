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
export type KbSource = "manual" | "shopify_sync" | "chat_promoted";

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
  created_at: string;
  updated_at: string;
};

export const KB_COLUMNS =
  "id,source,category,title,content,product_tags,status,last_reviewed_at,reviewed_by,source_ref,created_at,updated_at";

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

  return {
    row: {
      title,
      content,
      category,
      status,
      product_tags: tags,
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
 * Voyage is Anthropic's recommended embedding provider; with no key the
 * chunks are stored without embeddings and searched as text instead.
 */
export async function embed(texts: string[]): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || texts.length === 0) return null;
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.VOYAGE_MODEL || "voyage-3", input: texts, output_dimension: 1024 }),
    });
    if (!res.ok) {
      console.error("[kb] embedding failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  } catch (err) {
    console.error("[kb] embedding request failed", err);
    return null;
  }
}

/** Rewrite an article's chunks (and their embeddings, when available). */
export async function reindexArticle(article: Pick<KbArticle, "id" | "title" | "content">) {
  const pieces = chunk(`${article.title}\n\n${article.content}`);
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

export type KbMatch = { article_id: string; chunk_id: string; title: string; category: KbCategory; chunk_text: string; score: number };

/** Top matches for a customer's question, published articles only. */
export async function searchKb(query: string, limit = 6, tags?: string[]): Promise<KbMatch[]> {
  const [vector] = (await embed([query])) ?? [];
  const rows = await supabaseRest<KbMatch[]>("rpc/kb_search", {
    method: "POST",
    body: JSON.stringify({
      p_query: query,
      p_embedding: vector ? JSON.stringify(vector) : null,
      p_limit: limit,
      p_tags: tags && tags.length > 0 ? tags : null,
    }),
  });
  return (rows ?? []).map((r) => ({ ...r, score: Number(r.score) }));
}

/**
 * What the assistant answered and which approved articles it used. Kept so a
 * claim in a transcript can be traced back to the article a person published
 * — and so the team can see what customers ask that the base cannot answer.
 */
export async function logAiAnswer(entry: {
  uid?: string;
  question: string;
  answer: string;
  articleIds: string[];
  channel?: string;
  escalated?: boolean;
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
      }),
    });
  } catch (err) {
    // Logging must never cost the customer their answer.
    console.error("[kb] logging the answer failed", err);
  }
}

// When an article has to be looked at again.
//
// Health and beauty claims are the reason this exists: an ingredient note or a
// product claim that was true a year ago may not be, and nobody notices a
// quietly wrong answer. So every article the team wrote carries a review date.
//
// An overdue article stays published. Retrieval keeps using it, because a
// stale-but-correct answer is better than the assistant suddenly refusing to
// answer a question it could answer yesterday — what changes is that the
// screen asks someone to confirm it.
import type { KbArticle, KbCategory } from "@/lib/kb";

/** Anything making a claim about a body gets the shorter cycle. */
const REVIEW_DAYS: Record<KbCategory, number> = {
  ingredient: 180,
  product: 180,
  faq: 365,
  policy: 365,
  loyalty: 365,
  shipping: 365,
  payment: 365,
};

const DAY = 24 * 60 * 60 * 1000;

/** Product articles are rewritten from the catalogue daily; they review themselves. */
export function reviewable(article: Pick<KbArticle, "source" | "status">) {
  return article.status === "published" && article.source !== "shopify_sync";
}

export function reviewDueAt(article: Pick<KbArticle, "category" | "last_reviewed_at" | "created_at">): number {
  const from = Date.parse(article.last_reviewed_at ?? article.created_at);
  return from + REVIEW_DAYS[article.category] * DAY;
}

export function isReviewDue(article: Pick<KbArticle, "category" | "source" | "status" | "last_reviewed_at" | "created_at">, now = Date.now()) {
  return reviewable(article) && reviewDueAt(article) <= now;
}

/** "ถึงรอบรีวิวแล้ว" / "อีก 34 วัน" — for the article row. */
export function reviewLabel(article: Pick<KbArticle, "category" | "source" | "status" | "last_reviewed_at" | "created_at">, now = Date.now()) {
  if (!reviewable(article)) return null;
  const days = Math.ceil((reviewDueAt(article) - now) / DAY);
  if (days <= 0) return "ถึงรอบรีวิวแล้ว";
  if (days <= 30) return `ครบรอบรีวิวในอีก ${days} วัน`;
  return null;
}

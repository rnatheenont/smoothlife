import { getProductBySlug } from "@/data/products";
import { supabaseConfigured, supabaseRestCached, pgValue } from "@/lib/supabase-server";
import { CATEGORY_TH, type KbCategory } from "@/lib/kb";

// The half of the knowledge base that faces the public.
//
// Shopee has product pages and nothing else; a question a customer actually
// asked, answered by the team, is the one kind of page a marketplace cannot
// copy. But an article is only here when someone set its public_slug — being
// quotable by the assistant is not the same as being readable by a stranger,
// and most of these are written in the third person about customers rather
// than to them.
export type PublicQuestion = {
  title: string;
  content: string;
  category: KbCategory;
  public_slug: string;
  product_tags: string[];
  updated_at: string;
};

const COLUMNS = "title,content,category,public_slug,product_tags,updated_at";
const TAG = "kb-public";

/** Every question with a page, newest first. */
export async function getPublicQuestions(): Promise<PublicQuestion[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRestCached<PublicQuestion[]>(
      `kb_articles?status=eq.published&public_slug=not.is.null&select=${COLUMNS}&order=updated_at.desc&limit=500`,
      { revalidate: 900, tags: [TAG] }
    );
  } catch {
    return [];
  }
}

export async function getPublicQuestion(slug: string): Promise<PublicQuestion | null> {
  if (!supabaseConfigured()) return null;
  try {
    const rows = await supabaseRestCached<PublicQuestion[]>(
      `kb_articles?status=eq.published&public_slug=eq.${pgValue(slug)}&select=${COLUMNS}&limit=1`,
      { revalidate: 900, tags: [TAG, `kb-public:${slug}`] }
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The products an answer is about — the internal link from a question to
 * something buyable, which is the whole reason this content earns its keep.
 * Only products still in the catalogue; a tag can outlive the product.
 */
export function taggedProducts(tags: string[] | null | undefined) {
  return (tags ?? []).map((slug) => getProductBySlug(slug)).filter((p): p is NonNullable<typeof p> => Boolean(p));
}

export function categoryLabel(category: KbCategory) {
  return CATEGORY_TH[category] ?? "คำถามที่พบบ่อย";
}

/**
 * The first paragraph, for the meta description and the card on the index.
 * The answers are written as prose with blank lines between blocks, so the
 * opening block is the summary without anyone having to write one.
 */
export function excerptOf(content: string, max = 155) {
  const first = content.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

/**
 * A URL-safe slug that keeps Thai as Thai. Transliterating would produce
 * something no Thai reader recognises in a search result; browsers and Google
 * both handle percent-encoded Thai paths, and a Thai question in the URL
 * matches the Thai query someone typed.
 */
export function slugifyThai(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[?!."'`(){}[\]<>|\\/:;,*#@$%^&+=~]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

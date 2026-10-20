// The chat assistant's way into the knowledge base (the ai-knowledge-base
// plan, §B.5): shop policies, membership rules, ingredient notes and the
// answers the team has already approved.
//
// The rule this exists to enforce: on anything the shop decides — shipping,
// returns, payment, points, membership, claims about ingredients, how this
// site's own features work, and what becomes of a customer's photos — the
// assistant answers from an article a person published, or says it is not sure
// and offers the team. It does not answer those from its own knowledge.
//
// The scope above is the tool's description, and the description is what
// decides whether the model reaches for it at all. Asked "เก็บรูปหน้าหนูไว้ไหม"
// while the description listed only shop policy, it did not search — it
// answered from memory that no photo is ever kept, which is not what the
// consent gate says (a photo IS kept when the customer ticks the before/after
// box). A privacy answer invented by the model is the one failure here that
// cannot be allowed to stand, so photos and personal data are named
// explicitly.
import type Anthropic from "@anthropic-ai/sdk";
import { searchKb, KB_MIN_SCORE, type KbMatch } from "@/lib/kb";
import { supabaseRest, pgValue } from "@/lib/supabase-server";
import { recordGap } from "@/lib/kb-gaps";

// Below this the match is noise and the assistant should hand over instead.
// The number lives in kb.ts now and is sent to kb_search as p_min_score: the
// copy that used to be here was 0.35 against the function's 0.42, so it never
// decided anything — the rows it would have cut were already gone.
export { KB_MIN_SCORE };

export const KB_TOOL: Anthropic.Tool = {
  name: "search_knowledge_base",
  description:
    "Search Smoothlife's approved answers: shipping, returns and refunds, payment, membership and points, promotions, ingredient or usage notes, " +
    "how the site's own features work (the skin scan / Skin Coach, shop by concern, the advisors, subscriptions), " +
    "and what happens to a customer's photos and personal data. " +
    "Use it for ANY question about what the shop does or promises, about what this site does or how to use it, and before saying anything about a policy. " +
    "Your own general knowledge is not a source here — in particular, never state from memory what happens to a customer's face photo or personal data; that answer must come from an article. " +
    "Returns matching passages, best first, each with its article title. " +
    "A passage may also carry a link (อ่านเพิ่ม: /faq/…), the slugs of products its answer names, and a call to action. " +
    "When you answer from one, give the link so the customer can read the whole thing, and call get_product_details for any product slug before you mention it — " +
    "the price and the stock in your context are stale by the time you read them, and a price stated from memory is wrong in the one way a customer notices. " +
    "If nothing comes back, say you are not certain and offer to pass the question to the team; never guess a policy.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The customer's question in their own words (Thai is fine), or the key terms from it." },
      product_slug: { type: "string", description: "Optional: the product being discussed, to prefer notes written for it." },
    },
    required: ["query"],
  },
};

export type KbToolResult = { text: string; matches: KbMatch[] };

/** Runs the tool and returns what to hand back to the model, plus what it matched. */
export async function runKbTool(input: unknown): Promise<KbToolResult> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const tags = typeof args.product_slug === "string" && args.product_slug ? [args.product_slug] : undefined;
  if (!query) return { text: "No query given.", matches: [] };

  let matches: KbMatch[] = [];
  try {
    matches = (await searchKb(query, 6, tags)).filter((m) => m.score >= KB_MIN_SCORE);
  } catch (err) {
    console.error("[chat] knowledge-base search failed", err);
    return { text: "The knowledge base could not be reached. Tell the customer you are not sure and offer to pass this to the team.", matches: [] };
  }

  if (matches.length === 0) {
    // The question nobody can answer is the one worth writing down. Not
    // awaited: the customer's reply does not wait for the queue.
    void recordGap({ question: query, source: "chat" });
    return {
      text: "No approved article covers this. Do not answer it from general knowledge — say you are not certain and offer to pass the question to the team.",
      matches: [],
    };
  }

  const extras = await articleExtras(matches.map((m) => m.article_id));

  const text = matches
    .map((m, i) => {
      const e = extras.get(m.article_id);
      const lines = [`[${i + 1}] ${m.title} (${m.category})`, m.chunk_text];
      if (e?.public_slug) lines.push(`อ่านเพิ่ม: /faq/${e.public_slug}`);
      if (e?.product_tags?.length) lines.push(`product_slugs: ${e.product_tags.join(", ")}`);
      if (e?.cta_label && e.cta_href) lines.push(`cta: ${e.cta_label} → ${e.cta_href}`);
      return lines.join("\n");
    })
    .join("\n\n---\n\n");

  return {
    text:
      "Answer only from these approved passages. Quote what they say; do not add policy they do not state.\n" +
      "Give the อ่านเพิ่ม link when there is one. For any product_slugs, call get_product_details first — never state a price from these passages or from memory.\n\n" +
      text,
    matches,
  };
}

type ArticleExtras = {
  article_id: string;
  public_slug: string | null;
  product_tags: string[] | null;
  cta_label: string | null;
  cta_href: string | null;
};

/**
 * The parts of an article that are about where to go next rather than what to
 * say — its page, the products it names, its call to action.
 *
 * Fetched separately rather than added to kb_search's returned columns: the
 * search returns one row per chunk, so the same article's slug would come
 * back two or three times, and the function is also used by the eval and the
 * /faq search, neither of which wants them.
 */
async function articleExtras(ids: string[]): Promise<Map<string, ArticleExtras>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  try {
    const rows = await supabaseRest<ArticleExtras[]>(
      `kb_articles?id=in.(${unique.map(pgValue).join(",")})&select=id,public_slug,product_tags,cta_label,cta_href`
    );
    return new Map(
      rows.map((r) => [
        (r as unknown as { id: string }).id,
        { ...r, article_id: (r as unknown as { id: string }).id },
      ])
    );
  } catch (err) {
    // The passages are the answer; the links are a courtesy.
    console.error("[chat] reading article links failed", err);
    return new Map();
  }
}

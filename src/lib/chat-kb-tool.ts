// The chat assistant's way into the knowledge base (the ai-knowledge-base
// plan, §B.5): shop policies, membership rules, ingredient notes and the
// answers the team has already approved.
//
// The rule this exists to enforce: on anything the shop decides — shipping,
// returns, payment, points, membership, claims about ingredients — the
// assistant answers from an article a person published, or says it is not sure
// and offers the team. It does not answer those from its own knowledge.
import type Anthropic from "@anthropic-ai/sdk";
import { searchKb, type KbMatch } from "@/lib/kb";

/** Below this the match is noise, and the assistant should hand over instead. */
export const KB_MIN_SCORE = 0.35;

export const KB_TOOL: Anthropic.Tool = {
  name: "search_knowledge_base",
  description:
    "Search Smoothlife's approved answers: shipping, returns and refunds, payment, membership and points, promotions, and ingredient or usage notes the team has written. " +
    "Use it for ANY question about what the shop does or promises, and before saying anything about a policy — your own general knowledge is not a source here. " +
    "Returns matching passages, best first, each with its article title. If nothing comes back, say you are not certain and offer to pass the question to the team; never guess a policy.",
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
    return {
      text: "No approved article covers this. Do not answer it from general knowledge — say you are not certain and offer to pass the question to the team.",
      matches: [],
    };
  }

  const text = matches
    .map((m, i) => `[${i + 1}] ${m.title} (${m.category})\n${m.chunk_text}`)
    .join("\n\n---\n\n");
  return { text: `Answer only from these approved passages. Quote what they say; do not add policy they do not state.\n\n${text}`, matches };
}

/**
 * Which assistant sent a visitor, when one did.
 *
 * The attribution cookie already files these visits under one channel,
 * `ai_search` (src/lib/attribution.ts), and that stays the right unit for
 * "how much of the business comes from AI answers". This is the finer
 * question underneath it: which assistant — because the work to be found in
 * ChatGPT is not the work to be found in Perplexity, and a single number
 * cannot tell you which one is paying off.
 *
 * Derived at read time from the referrer host and utm_source that every
 * order already stores, rather than captured as a new column. Those two
 * fields are kept verbatim precisely so questions like this one can be asked
 * later: adding `attr_ai_engine` would answer it only for orders placed
 * after the migration, and would leave two fields that must agree.
 *
 * It undercounts, and cannot do otherwise. Several of these apps strip the
 * referrer before opening a link — especially their mobile clients — so a
 * visit that really came from an AI answer often arrives looking like
 * someone typing the address in. The number is a floor, never a total, and
 * the admin screen says so where it is shown.
 */

export const AI_ENGINES = ["chatgpt", "perplexity", "gemini", "copilot", "claude"] as const;

export type AiEngine = (typeof AI_ENGINES)[number];

/** Host fragments and utm_source fragments, per engine. Fragments rather
 *  than exact names: these vendors move between hostnames (chat.openai.com
 *  to chatgpt.com) more often than they rename themselves. */
const SIGNS: [AiEngine, string[]][] = [
  ["chatgpt", ["chatgpt.com", "chat.openai.com", "openai.com", "chatgpt", "openai"]],
  ["perplexity", ["perplexity.ai", "perplexity"]],
  // Checked before anything matching plain "google": gemini.google.com is an
  // assistant, google.com is a search engine, and filing one as the other is
  // the mistake this whole breakdown exists to avoid.
  ["gemini", ["gemini.google.com", "bard.google.com", "gemini", "bard"]],
  ["copilot", ["copilot.microsoft.com", "bing.com/chat", "copilot"]],
  ["claude", ["claude.ai", "claude"]],
];

/**
 * The assistant behind a visit, or null when it did not come from one.
 *
 * utm_source wins over the referrer: a tagged link is something somebody
 * chose to say about where this click came from, while a referrer is
 * whatever the browser happened to send.
 */
export function aiEngineOf(
  utmSource: string | null | undefined,
  referrerHost: string | null | undefined,
): AiEngine | null {
  const source = (utmSource ?? "").toLowerCase();
  if (source) {
    for (const [engine, signs] of SIGNS) {
      if (signs.some((s) => source.includes(s))) return engine;
    }
  }

  const host = (referrerHost ?? "").toLowerCase();
  if (host) {
    for (const [engine, signs] of SIGNS) {
      // Host matching uses the hostname fragments only — the bare product
      // names ("claude", "gemini") would match somebody else's domain that
      // happens to contain the word.
      if (signs.some((s) => s.includes(".") && host.includes(s))) return engine;
    }
  }

  return null;
}

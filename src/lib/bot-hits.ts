/**
 * Which search and AI crawlers actually read the pages we opened to them.
 *
 * Opening /faq to search is a bet, and this is how we find out whether it
 * paid: Googlebot arriving means the page is in the crawl, OAI-SearchBot
 * arriving means ChatGPT fetched an answer to quote. Neither shows up in
 * Search Console for weeks, and Vercel's log retention on this plan is far
 * too short to look back over, so the count has to be kept by us as it
 * happens.
 *
 * Counted in the proxy, which means two rules this file exists to keep:
 *
 * It never delays a response. The write goes out through waitUntil, after
 * the page has already been sent, and a failure is swallowed — a crawler
 * that cannot be counted is a missing row in a report, not a page that
 * failed to load for somebody.
 *
 * And it only counts the paths that are open to search. That is not a
 * filter for tidiness: it is what bounds the table. The open set is /faq
 * plus one page per published answer, a few dozen rows a day, so the table
 * cannot grow with whatever a scanner decides to probe.
 */

/**
 * The crawlers worth telling apart, as the substring to look for in the
 * user-agent and the name to file the hit under.
 *
 * Ordered, and the first match wins: ChatGPT-User must be tested before
 * GPTBot, since OpenAI's retrieval agent carries both names. Matching is
 * case-insensitive and deliberately loose — a vendor appending a version to
 * its own name should not silently stop being counted.
 */
const BOTS: [needle: string, name: string][] = [
  ["chatgpt-user", "ChatGPT-User"],
  ["oai-searchbot", "OAI-SearchBot"],
  ["gptbot", "GPTBot"],
  ["perplexitybot", "PerplexityBot"],
  ["perplexity-user", "Perplexity-User"],
  ["claude-searchbot", "Claude-SearchBot"],
  ["claudebot", "ClaudeBot"],
  ["claude-user", "Claude-User"],
  ["google-extended", "Google-Extended"],
  ["googlebot", "Googlebot"],
  ["bingbot", "Bingbot"],
  ["applebot", "Applebot"],
  ["duckduckbot", "DuckDuckBot"],
];

/** The crawler behind a user-agent, or null for an ordinary visitor. */
export function botName(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const [needle, name] of BOTS) {
    if (ua.includes(needle)) return name;
  }
  return null;
}

/**
 * Add one to today's count for this crawler and path.
 *
 * Talks to PostgREST directly rather than through supabase-server: this runs
 * in the proxy, which is in front of every page, and the proxy bundle should
 * not pull in a module graph built for route handlers.
 *
 * Never throws. The caller is a page that has already been sent.
 */
export async function recordBotHit(bot: string, pathname: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/rpc/bot_hit`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      // The path is stored without its query string: ?topic=oral-care is the
      // same page to a crawler, and keeping them apart would turn one row
      // into one per combination somebody links.
      body: JSON.stringify({ p_bot: bot, p_path: pathname.slice(0, 200) }),
    });
  } catch {
    // Counted or not, the reader already has their page.
  }
}

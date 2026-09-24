import { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

const DISALLOW = ["/account/", "/cart", "/checkout", "/chat", "/api/", "/flash-sale/", "/campaigns/"];

// Every AI crawler gets the same access as everyone else (the wildcard rule
// below already covers them) — these are named explicitly anyway, because a
// wildcard reads as "nobody thought about this," and a small brand has more
// to gain from being known to a model than it has to lose. Split into two
// groups so the choice each one represents stays visible in the source
// rather than buried in a decision nobody wrote down:
//   - retrieval: fetches a page to answer one person's question right now
//     (ChatGPT browsing, Perplexity, Claude's web search)
//   - training: folds pages into a future model's weights, with no request
//     or referral attached to this moment (GPTBot, ClaudeBot, Google's
//     Extended flag, Common Crawl — which several labs train from)
// Revisit this if that trade ever stops making sense — block a name here by
// giving it its own `disallow: "/"` rule.
const AI_RETRIEVAL_BOTS = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-Web"];
const AI_TRAINING_BOTS = ["GPTBot", "ClaudeBot", "anthropic-ai", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...[...AI_RETRIEVAL_BOTS, ...AI_TRAINING_BOTS].map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

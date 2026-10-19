// First-touch marketing attribution: which channel a shopper first arrived
// from, captured once at their first page view (src/proxy.ts) and carried
// through checkout onto payment_transactions — so "% of sales from social"
// is a real number instead of a guess. Unrelated to the /r/[code] referral
// (affiliate) cookie, which tracks who invited whom, not traffic source.

export type AttributionChannel =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "line"
  | "google"
  | "ai_search"
  | "referral"
  | "direct"
  | "other";

// Hosts a click FROM an AI answer (ChatGPT, Perplexity, Copilot, Gemini,
// Claude, You.com) arrives with — a distinct channel from "google" because a
// citation an AI chose to surface is a different kind of visit than an
// organic search result someone clicked themselves. Undercounts on purpose
// rather than guesses: several of these apps (especially their mobile
// clients) strip the referrer entirely before opening a link, so this can
// only ever prove a floor, never the true total.
const AI_SEARCH_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "copilot.microsoft.com",
  "gemini.google.com",
  "claude.ai",
  "you.com",
];

// Every hostname that is us. Without this a shopper walking from one of our
// own pages to the next is filed as traffic somebody else sent us.
//
// `hostOf` has already stripped a leading "www.", which is why only the bare
// apex is listed. `app.smoothlife.com` is where the app answers while the
// shop itself still runs on Shopify, and preview deployments answer on a
// *.vercel.app name that changes with every deploy — so that one is matched
// by suffix rather than listed.
const OWN_HOSTS = ["smoothlife.com", "app.smoothlife.com"];

function isOwnHost(host: string): boolean {
  return OWN_HOSTS.includes(host) || host.endsWith(".vercel.app");
}

export type AttributionPayload = {
  channel: AttributionChannel;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_host: string | null;
};

export const ATTRIBUTION_COOKIE = "sl_attr";

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** utm_source, then referrer domain, then "no referrer at all" — in that
 *  priority order, since a tagged link is a stronger signal than whatever
 *  domain happened to link here. */
function resolveChannel(utmSource: string | null, referrerHost: string | null): AttributionChannel {
  const source = (utmSource ?? "").toLowerCase();
  if (source.includes("facebook") || source === "fb") return "facebook";
  if (source.includes("instagram") || source === "ig") return "instagram";
  if (source.includes("tiktok")) return "tiktok";
  if (source.includes("line")) return "line";
  if (["chatgpt", "openai", "perplexity", "copilot", "gemini", "claude"].some((s) => source.includes(s))) {
    return "ai_search";
  }
  if (source.includes("google")) return "google";

  const host = referrerHost ?? "";
  if (host.includes("facebook.com") || host.includes("fb.com")) return "facebook";
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("line.me") || host.includes("liff.line.me")) return "line";
  // Checked before the generic google.* rule below — gemini.google.com must
  // not fall into plain "google", the two mean different things here.
  if (AI_SEARCH_HOSTS.some((h) => host.includes(h))) return "ai_search";
  if (host.includes("google.")) return "google";

  if (!referrerHost) return "direct";
  // A referrer that is one of our own pages means the same visit carrying on,
  // not a new source — the cookie just happened to be written part-way
  // through it rather than on the very first request.
  if (isOwnHost(host)) return "direct";
  return "other";
}

/** Built once, in the proxy, from the very first request of a new visitor —
 *  never re-derived later, so a later organic visit can't overwrite how they
 *  originally found us. */
export function buildAttribution(url: URL, referrer: string | null): AttributionPayload {
  const utm_source = url.searchParams.get("utm_source");
  const utm_medium = url.searchParams.get("utm_medium");
  const utm_campaign = url.searchParams.get("utm_campaign");
  const referrer_host = hostOf(referrer);
  return {
    channel: resolveChannel(utm_source, referrer_host),
    utm_source,
    utm_medium,
    utm_campaign,
    referrer_host,
  };
}

export function parseAttributionCookie(raw: string | undefined | null): AttributionPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.channel === "string") return parsed as AttributionPayload;
    return null;
  } catch {
    return null;
  }
}

// 30 days: long enough to cover a real "saw the ad, bought it two weeks
// later" gap, which is common for a skincare purchase decision. httpOnly
// since only checkout's own API routes ever need to read it back — nothing
// in the browser does.
export function attributionCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  };
}

/** The handful of fields every payment_transactions insert should carry —
 *  spread this into the insert body so checkout/init and flash-sale/pay
 *  don't each re-derive it slightly differently. */
export function attributionColumns(cookieValue: string | undefined | null) {
  const attr = parseAttributionCookie(cookieValue);
  return {
    attr_channel: attr?.channel ?? "direct",
    attr_utm_source: attr?.utm_source ?? null,
    attr_utm_medium: attr?.utm_medium ?? null,
    attr_utm_campaign: attr?.utm_campaign ?? null,
    attr_referrer_host: attr?.referrer_host ?? null,
  };
}

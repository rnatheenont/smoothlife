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
  | "referral"
  | "direct"
  | "other";

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
  if (source.includes("google")) return "google";

  const host = referrerHost ?? "";
  if (host.includes("facebook.com") || host.includes("fb.com")) return "facebook";
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("line.me") || host.includes("liff.line.me")) return "line";
  if (host.includes("google.")) return "google";

  if (!referrerHost) return "direct";
  if (host === "smoothlife.com" || host === "www.smoothlife.com") return "direct";
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

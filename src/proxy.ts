import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { checkAdminPermission } from "@/lib/admin-permissions";
import { isPublicAdminRoute, ruleFor } from "@/lib/admin-route-permissions";
import { ATTRIBUTION_COOKIE, attributionCookieOptions, buildAttribution } from "@/lib/attribution";
import { botName, recordBotHit } from "@/lib/bot-hits";
import { indexableRequest } from "@/lib/search-visibility";

function deny(status: 401 | 403, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * One gate in front of every admin API route.
 *
 * Until now each route asked only "are you signed in", which left the five
 * roles as a label on a row and nothing more: whoever could open the panel
 * could refund a payment, issue a gift card or publish to the knowledge base,
 * whatever their role said. Checking that here rather than in each of the
 * sixty-odd handlers is what makes it hold for routes nobody has written yet
 * — an unlisted path is refused, so a new endpoint has to be granted access
 * on purpose instead of inheriting it by being forgotten.
 */
async function guardAdminApi(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Signing in, and getting back in — there is no session to check yet.
  if (isPublicAdminRoute(pathname)) return null;

  const rule = ruleFor(pathname, req.method);
  if (!rule) {
    console.error(
      `[admin] no permission rule for ${req.method} ${pathname} — denied. Add it to admin-route-permissions.ts`
    );
    return deny(403, "เส้นทางนี้ยังไม่ได้กำหนดสิทธิ์การเข้าถึง กรุณาแจ้งผู้ดูแลระบบ");
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return deny(401, "กรุณาเข้าสู่ระบบแอดมิน");

  // Signed in is the whole requirement — either every role is meant to have
  // it, or the route gates itself more strictly (accounts and roles do).
  if (rule.permission === null) return null;

  const result = await checkAdminPermission(token, rule.permission);
  if (!result.ok) return deny(403, "บัญชีของคุณไม่มีสิทธิ์ใช้งานส่วนนี้");
  return null;
}


/**
 * campaign.smoothlife.com shows the campaign, and nothing else.
 *
 * It exists so a link handed to customers carries the shop's own domain
 * instead of a vercel.app address — a page asking people to upload a receipt
 * has to look like the shop it claims to be. But pointing a branded subdomain
 * at this project would otherwise put the whole unlaunched site on it, where
 * campaign.smoothlife.com/shop reads as an announcement nobody has made.
 *
 * So everything outside /campaigns goes to the live store. The API paths the
 * campaign itself calls stay, or the page would be a shell that cannot log
 * anyone in or take an upload.
 */
const CAMPAIGN_HOST = "campaign.smoothlife.com";
// A special flash sale is a campaign too — same chrome, same login, same
// kind of link going out — so the campaign host serves it as well.
const CAMPAIGN_ALLOWED = [
  "/campaigns",
  "/api/campaigns",
  "/flash-sale",
  "/api/flash-sale",
  "/api/auth",
  "/api/account",
  "/account",
];

function offCampaignHost(req: NextRequest) {
  if (req.headers.get("host") !== CAMPAIGN_HOST) return null;
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return null;
  if (CAMPAIGN_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  // The store, not this site's own home page: someone who lands here by
  // trimming the URL is looking for the shop.
  return NextResponse.redirect(new URL(pathname === "/" ? "/" : pathname, "https://www.smoothlife.com"), 307);
}

/**
 * Everyone who still has the old address gets moved to the new one.
 *
 * Two deliberate limits:
 *
 * It does nothing until NEXT_PUBLIC_SITE_URL names a real custom domain, so
 * this can ship before the DNS record exists without sending the whole site
 * to a host that does not resolve yet. Moving the shop is then one variable.
 *
 * And it never touches /api. Shopify, LINE and 2C2P all hold webhook URLs on
 * the old host, and a POST that meets a redirect is not re-sent by most of
 * them — it is simply lost. Those keep answering where they were registered
 * until each console is updated by hand.
 */
const OLD_HOST = "smoothlife.vercel.app";

function movedHost(req: NextRequest) {
  if (req.headers.get("host") !== OLD_HOST) return null;
  const home = process.env.NEXT_PUBLIC_SITE_URL;
  if (!home || home.includes(".vercel.app")) return null;

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) return null;

  return NextResponse.redirect(new URL(`${pathname}${search}`, home), 308);
}

/**
 * Hosts that serve the shop but must never be found in search.
 *
 * app.smoothlife.com is where the app is being tried out before it moves
 * anywhere customers are sent — same pages, same products, same words as the
 * real shop. Indexed, it would compete with www.smoothlife.com using the
 * shop's own content, and taking a page back out of Google is slower and
 * less certain than keeping it out. The list is explicit rather than a
 * pattern: the day this app does become the shop, the way to let it be found
 * is to take its name off this list, which is a decision someone makes on
 * purpose rather than a side effect of a rename.
 */
const UNLISTED_HOSTS = new Set(["app.smoothlife.com"]);

function hiddenFromSearch(host: string | null): boolean {
  if (!host) return false;
  // Port included on a host header is not part of the name.
  const name = host.split(":")[0].toLowerCase();
  return name.endsWith(".vercel.app") || UNLISTED_HOSTS.has(name);
}

// The raw *.vercel.app deployment URL serves the exact same content as
// www.smoothlife.com — without this, Google could index both and treat
// them as duplicate sites. robots.txt/sitemap already point at the real
// domain; this stops the vercel.app one from being indexable at all,
// regardless of what crawls it directly.
export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const moved = movedHost(req);
  if (moved) return moved;

  const elsewhere = offCampaignHost(req);
  if (elsewhere) return elsewhere;

  if (req.nextUrl.pathname.startsWith("/api/admin/")) {
    const refused = await guardAdminApi(req);
    if (refused) return refused;
  }

  const res = NextResponse.next();
  const host = req.headers.get("host");
  // The FAQ, on the host the canonical tags name, is the one thing here that
  // exists nowhere else and is allowed to be found — see search-visibility.ts
  // for why that is two conditions rather than one.
  const indexable = indexableRequest(host, req.nextUrl.pathname);
  if (hiddenFromSearch(host) && !indexable) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // Who is reading the pages we opened. Only on those pages, and only after
  // the response has gone out — see bot-hits.ts.
  if (indexable && req.method === "GET") {
    const bot = botName(req.headers.get("user-agent"));
    if (bot) event.waitUntil(recordBotHit(bot, req.nextUrl.pathname));
  }

  // First-touch attribution: only a real page view can be someone's first
  // touch, and only ever set once — an admin/API call has no "referrer" a
  // shopper saw, and overwriting it on a later visit would credit the wrong
  // channel for a sale that happened weeks after the first click.
  if (
    req.method === "GET" &&
    !req.nextUrl.pathname.startsWith("/api/") &&
    !req.cookies.get(ATTRIBUTION_COOKIE)
  ) {
    const attribution = buildAttribution(req.nextUrl, req.headers.get("referer"));
    res.cookies.set(ATTRIBUTION_COOKIE, JSON.stringify(attribution), attributionCookieOptions());
  }

  return res;
}

export const config = {
  // Not on files. Everything this proxy does — the old-host redirect, the
  // noindex header for *.vercel.app, the admin API gate and the first-touch
  // attribution cookie — is about pages and API routes. Running it on every
  // mascot PNG, font, model and icon cost one function invocation per file
  // (Hobby's quota), held each one up behind it, and set an attribution
  // cookie on image requests. Admin API paths have no file extension, so the
  // gate still sees every one of them.
  matcher:
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|webp|avif|gif|svg|ico|mp4|webm|woff2?|ttf|otf|wasm|task|tflite|bin|json|txt|xml|js|css|map)$).*)",
};

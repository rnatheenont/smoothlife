import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { checkAdminPermission } from "@/lib/admin-permissions";
import { isPublicAdminRoute, ruleFor } from "@/lib/admin-route-permissions";
import { ATTRIBUTION_COOKIE, attributionCookieOptions, buildAttribution } from "@/lib/attribution";

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

// The raw *.vercel.app deployment URL serves the exact same content as
// www.smoothlife.com — without this, Google could index both and treat
// them as duplicate sites. robots.txt/sitemap already point at the real
// domain; this stops the vercel.app one from being indexable at all,
// regardless of what crawls it directly.
export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/admin/")) {
    const refused = await guardAdminApi(req);
    if (refused) return refused;
  }

  const res = NextResponse.next();
  if (req.headers.get("host")?.endsWith(".vercel.app")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
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
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};

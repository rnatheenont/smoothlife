import { NextRequest, NextResponse } from "next/server";

// The raw *.vercel.app deployment URL serves the exact same content as
// www.smoothlife.com — without this, Google could index both and treat
// them as duplicate sites. robots.txt/sitemap already point at the real
// domain; this stops the vercel.app one from being indexable at all,
// regardless of what crawls it directly.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (req.headers.get("host")?.endsWith(".vercel.app")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};

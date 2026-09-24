import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { SSO_OPT_OUT_COOKIE } from "@/lib/shopify-email-login";
import { SHOPIFY_ID_TOKEN_COOKIE, buildLogoutUrl } from "@/lib/shopify-customer-auth";

// Signing out has to mean it on both sides.
//
// The Shopify session lives on shopify.com and no cookie we clear here can
// touch it, so on its own a local sign-out lasts until the next page load: the
// silent attempt finds that session and walks them straight back in, which
// reads as a button that does not work. Two things fix it together — a cookie
// that stops the automatic attempt for twelve hours, and Shopify's own logout
// endpoint, which the browser is sent to so their session ends as well.
//
// The redirect is returned rather than followed, because this is a fetch from
// the page and the navigation belongs to the caller.
const OPT_OUT_HOURS = 12;

export async function POST(req: NextRequest) {
  const idToken = req.cookies.get(SHOPIFY_ID_TOKEN_COOKIE)?.value;
  // Has to match a Logout URI registered on the Shopify app exactly, trailing
  // slash included.
  const shopifyLogoutUrl = await buildLogoutUrl(idToken, new URL("/", req.url).toString());

  const res = NextResponse.json({ ok: true, shopifyLogoutUrl });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(SHOPIFY_ID_TOKEN_COOKIE);
  res.cookies.set(SSO_OPT_OUT_COOKIE, "1", {
    // Read in the browser, by the component that decides whether to try.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OPT_OUT_HOURS * 3600,
  });
  return res;
}

import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { SSO_OPT_OUT_COOKIE } from "@/lib/shopify-email-login";

// Signing out has to outlast the next page load. The Shopify session lives on
// shopify.com and we cannot end it from here, so the automatic sign-in would
// find it and walk them straight back in — which reads as a sign-out button
// that does not work. This cookie is how the browser knows not to try.
const OPT_OUT_HOURS = 12;

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
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

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { GOOGLE_STATE_COOKIE, GOOGLE_RETURN_COOKIE, googleConfigured, googleOauthCookieOptions } from "@/lib/google-auth";

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/account";

  if (!googleConfigured()) {
    const url = new URL("/account/login", req.url);
    url.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(url);
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/google/callback", req.url).toString();

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "openid email profile");

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(GOOGLE_STATE_COOKIE, state, googleOauthCookieOptions);
  res.cookies.set(GOOGLE_RETURN_COOKIE, returnTo, googleOauthCookieOptions);
  return res;
}

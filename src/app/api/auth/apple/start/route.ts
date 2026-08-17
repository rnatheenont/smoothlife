import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { APPLE_STATE_COOKIE, APPLE_RETURN_COOKIE, appleConfigured, appleOauthCookieOptions } from "@/lib/apple-auth";

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/account";

  if (!appleConfigured()) {
    const url = new URL("/account/login", req.url);
    url.searchParams.set("error", "apple_not_configured");
    return NextResponse.redirect(url);
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/apple/callback", req.url).toString();

  const authorizeUrl = new URL("https://appleid.apple.com/auth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("response_mode", "form_post");
  authorizeUrl.searchParams.set("client_id", process.env.APPLE_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "name email");

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(APPLE_STATE_COOKIE, state, appleOauthCookieOptions);
  res.cookies.set(APPLE_RETURN_COOKIE, returnTo, appleOauthCookieOptions);
  return res;
}

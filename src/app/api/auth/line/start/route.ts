import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { LINE_STATE_COOKIE, LINE_RETURN_COOKIE, lineConfigured, lineOauthCookieOptions } from "@/lib/line-auth";

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/account";

  if (!lineConfigured()) {
    const url = new URL("/account/login", req.url);
    url.searchParams.set("error", "line_not_configured");
    return NextResponse.redirect(url);
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/line/callback", req.url).toString();

  const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", process.env.LINE_CHANNEL_ID!);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "profile");
  authorizeUrl.searchParams.set("ui_locales", "th");

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(LINE_STATE_COOKIE, state, lineOauthCookieOptions);
  res.cookies.set(LINE_RETURN_COOKIE, returnTo, lineOauthCookieOptions);
  return res;
}

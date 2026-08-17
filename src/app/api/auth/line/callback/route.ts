import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { LINE_STATE_COOKIE, LINE_RETURN_COOKIE, lineConfigured } from "@/lib/line-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function fail(req: NextRequest, reason: string) {
  const url = new URL("/account/login", req.url);
  url.searchParams.set("error", reason);
  const res = NextResponse.redirect(url);
  res.cookies.delete(LINE_STATE_COOKIE);
  res.cookies.delete(LINE_RETURN_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  if (!lineConfigured() || !supabaseConfigured()) return fail(req, "line_not_configured");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail(req, "line_denied");

  const code = params.get("code");
  const state = params.get("state");
  const cookieState = req.cookies.get(LINE_STATE_COOKIE)?.value;
  const returnTo = req.cookies.get(LINE_RETURN_COOKIE)?.value || "/account";
  if (!code || !state || !cookieState || !safeEqual(state, cookieState)) {
    return fail(req, "line_state_mismatch");
  }

  try {
    const redirectUri = new URL("/api/auth/line/callback", req.url).toString();
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_CHANNEL_ID!,
        client_secret: process.env.LINE_CHANNEL_SECRET!,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}: ${await tokenRes.text()}`);
    const tokenData = await tokenRes.json();

    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`profile fetch ${profileRes.status}`);
    const profile: { userId: string; displayName: string; pictureUrl?: string } = await profileRes.json();

    const result = await supabaseRest<{ user_id: string }[]>("rpc/find_or_create_line_member", {
      method: "POST",
      body: JSON.stringify({
        p_line_user_id: profile.userId,
        p_display_name: profile.displayName,
        p_avatar_url: profile.pictureUrl || null,
      }),
    });
    const userId = result[0]?.user_id;
    if (!userId) throw new Error("no user_id returned from find_or_create_line_member");

    // Backfill the Shopify link, same as every other login path — only
    // bother if it isn't already linked. LINE's "profile" scope doesn't
    // hand over an email/phone, so this is a safe no-op today, but picks
    // up automatically if that scope is ever widened.
    const [user] = await supabaseRest<
      { display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]
    >(`users?id=eq.${userId}&select=display_name,phone,shopify_customer_id`);
    if (user && !user.shopify_customer_id) {
      await linkOrCreateShopifyCustomer(userId, {
        currentDisplayName: user.display_name,
        currentPhone: user.phone,
      });
    }

    const res = NextResponse.redirect(new URL(returnTo, req.url));
    res.cookies.set(SESSION_COOKIE, createSessionToken(userId), sessionCookieOptions);
    res.cookies.delete(LINE_STATE_COOKIE);
    res.cookies.delete(LINE_RETURN_COOKIE);
    return res;
  } catch (err) {
    console.error("[line callback]", err);
    return fail(req, "line_error");
  }
}

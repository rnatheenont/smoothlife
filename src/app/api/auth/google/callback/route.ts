import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { GOOGLE_STATE_COOKIE, GOOGLE_RETURN_COOKIE, googleConfigured } from "@/lib/google-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";
import { attributeReferralSignup } from "@/lib/referral-signup";

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function fail(req: NextRequest, reason: string) {
  const url = new URL("/account/login", req.url);
  url.searchParams.set("error", reason);
  const res = NextResponse.redirect(url);
  res.cookies.delete(GOOGLE_STATE_COOKIE);
  res.cookies.delete(GOOGLE_RETURN_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  if (!googleConfigured() || !supabaseConfigured()) return fail(req, "google_not_configured");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail(req, "google_denied");

  const code = params.get("code");
  const state = params.get("state");
  const cookieState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const returnTo = req.cookies.get(GOOGLE_RETURN_COOKIE)?.value || "/account";
  if (!code || !state || !cookieState || !safeEqual(state, cookieState)) {
    return fail(req, "google_state_mismatch");
  }

  try {
    const redirectUri = new URL("/api/auth/google/callback", req.url).toString();
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}: ${await tokenRes.text()}`);
    const tokenData = await tokenRes.json();

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`profile fetch ${profileRes.status}`);
    const profile: { sub: string; name?: string; email?: string; picture?: string } = await profileRes.json();

    const result = await supabaseRest<{ user_id: string; is_new: boolean }[]>("rpc/find_or_create_google_member", {
      method: "POST",
      body: JSON.stringify({
        p_google_user_id: profile.sub,
        p_display_name: profile.name || null,
        p_email: profile.email || null,
        p_avatar_url: profile.picture || null,
      }),
    });
    const userId = result[0]?.user_id;
    const isNew = result[0]?.is_new ?? false;
    if (!userId) throw new Error("no user_id returned from find_or_create_google_member");

    // Backfill the Shopify link, same as every other login path — only
    // bother if it isn't already linked.
    const [user] = await supabaseRest<
      { display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]
    >(`users?id=eq.${userId}&select=display_name,phone,shopify_customer_id`);
    let shopifyCustomerId = user?.shopify_customer_id ?? null;
    if (user && !user.shopify_customer_id) {
      const shopifyLink = await linkOrCreateShopifyCustomer(userId, {
        email: profile.email || null,
        currentDisplayName: user.display_name,
        currentPhone: user.phone,
      });
      shopifyCustomerId = shopifyLink.shopifyCustomerId;
    }

    await attributeReferralSignup(req, { newUserId: userId, isNewAccount: isNew, shopifyCustomerId });

    // First-time signups land on a short profile-completion step (name,
    // phone, email if missing, address) before the app itself — returning
    // members skip straight to returnTo like every other login path.
    const destination = isNew
      ? new URL(`/account/complete-profile?returnTo=${encodeURIComponent(returnTo)}`, req.url)
      : new URL(returnTo, req.url);

    const res = NextResponse.redirect(destination);
    res.cookies.set(SESSION_COOKIE, createSessionToken(userId), sessionCookieOptions);
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    res.cookies.delete(GOOGLE_RETURN_COOKIE);
    return res;
  } catch (err) {
    console.error("[google callback]", err);
    return fail(req, "google_error");
  }
}

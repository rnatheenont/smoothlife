import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  APPLE_STATE_COOKIE,
  APPLE_RETURN_COOKIE,
  appleConfigured,
  decodeAppleIdToken,
  generateAppleClientSecret,
} from "@/lib/apple-auth";
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
  res.cookies.delete(APPLE_STATE_COOKIE);
  res.cookies.delete(APPLE_RETURN_COOKIE);
  return res;
}

// Apple posts here as a cross-site form submission (response_mode=form_post)
// rather than a GET redirect with query params like LINE uses.
export async function POST(req: NextRequest) {
  if (!appleConfigured() || !supabaseConfigured()) return fail(req, "apple_not_configured");

  const form = await req.formData();
  const code = form.get("code");
  const state = form.get("state");
  const errorParam = form.get("error");
  const userField = form.get("user"); // JSON string, only present on the very first authorization

  if (errorParam) return fail(req, "apple_denied");

  const cookieState = req.cookies.get(APPLE_STATE_COOKIE)?.value;
  const returnTo = req.cookies.get(APPLE_RETURN_COOKIE)?.value || "/account";
  if (typeof code !== "string" || typeof state !== "string" || !cookieState || !safeEqual(state, cookieState)) {
    return fail(req, "apple_state_mismatch");
  }

  try {
    const redirectUri = new URL("/api/auth/apple/callback", req.url).toString();
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: generateAppleClientSecret(),
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}: ${await tokenRes.text()}`);
    const tokenData = await tokenRes.json();

    const claims = decodeAppleIdToken(tokenData.id_token);
    if (!claims) throw new Error("could not decode id_token");

    let displayName: string | null = null;
    if (typeof userField === "string") {
      try {
        const parsed = JSON.parse(userField);
        const first = parsed?.name?.firstName;
        const last = parsed?.name?.lastName;
        displayName = [first, last].filter(Boolean).join(" ") || null;
      } catch {
        // malformed "user" field — proceed without a name, same as any
        // other provider that doesn't hand one over
      }
    }

    const result = await supabaseRest<{ user_id: string; is_new: boolean }[]>("rpc/find_or_create_apple_member", {
      method: "POST",
      body: JSON.stringify({
        p_apple_user_id: claims.sub,
        p_display_name: displayName,
        p_email: claims.email || null,
      }),
    });
    const userId = result[0]?.user_id;
    const isNew = result[0]?.is_new ?? false;
    if (!userId) throw new Error("no user_id returned from find_or_create_apple_member");

    // Backfill the Shopify link, same as every other login path — only
    // bother if it isn't already linked. Apple only hands over the email
    // on the very first authorization, so later logins skip this safely
    // once shopify_customer_id is already set.
    const [user] = await supabaseRest<
      { display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]
    >(`users?id=eq.${userId}&select=display_name,phone,shopify_customer_id`);
    let shopifyCustomerId = user?.shopify_customer_id ?? null;
    if (user && !user.shopify_customer_id) {
      const shopifyLink = await linkOrCreateShopifyCustomer(userId, {
        email: claims.email || null,
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
    res.cookies.delete(APPLE_STATE_COOKIE);
    res.cookies.delete(APPLE_RETURN_COOKIE);
    return res;
  } catch (err) {
    console.error("[apple callback]", err);
    return fail(req, "apple_error");
  }
}

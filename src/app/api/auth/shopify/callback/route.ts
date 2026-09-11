import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import {
  SHOPIFY_AUTH_COOKIE,
  exchangeCodeForEmail,
  shopifyEmailAuthConfigured,
  type ShopifyAuthTransaction,
} from "@/lib/shopify-customer-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { createSessionToken, verifySessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { ensureShopifyLink } from "@/lib/link-shopify-customer";
import { attributeReferralSignup } from "@/lib/referral-signup";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

type UserRow = { display_name: string | null; phone: string | null; shopify_customer_id: string | null };

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Each intent started from a different page, so a failure goes back there
// rather than dumping everyone on the login screen.
function failPath(intent: ShopifyAuthTransaction["intent"] | undefined) {
  if (intent === "link") return "/account/profile";
  if (intent === "reset") return "/account/forgot-password";
  return "/account/login";
}

function redirect(req: NextRequest, path: string, params: Record<string, string> = {}) {
  const url = new URL(path, req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete(SHOPIFY_AUTH_COOKIE);
  return res;
}

async function linkShopify(userId: string, email: string) {
  const [user] = await supabaseRest<UserRow[]>(
    `users?id=eq.${userId}&select=display_name,phone,shopify_customer_id`
  );
  if (!user) return null;
  const link = await ensureShopifyLink(userId, {
    email,
    currentShopifyCustomerId: user.shopify_customer_id,
    currentDisplayName: user.display_name,
    currentPhone: user.phone,
  });
  return link.shopifyCustomerId;
}

export async function GET(req: NextRequest) {
  let transaction: ShopifyAuthTransaction | null = null;
  try {
    transaction = JSON.parse(req.cookies.get(SHOPIFY_AUTH_COOKIE)?.value || "null");
  } catch {
    transaction = null;
  }
  const intent = transaction?.intent;

  if (!shopifyEmailAuthConfigured() || !supabaseConfigured()) {
    return redirect(req, failPath(intent), { error: "shopify_not_configured" });
  }
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return redirect(req, failPath(intent), { error: "shopify_denied" });

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !transaction || !safeEqual(state, transaction.state)) {
    return redirect(req, failPath(intent), { error: "shopify_state_mismatch" });
  }

  try {
    const redirectUri = new URL("/api/auth/shopify/callback", req.url).toString();
    const { email } = await exchangeCodeForEmail({ code, redirectUri, transaction });

    // ── Add or change the email on the account already signed in ──────────
    if (transaction.intent === "link") {
      const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
      if (!uid) return redirect(req, "/account/login", { error: "shopify_error" });
      const [row] = await supabaseRest<{ ok: boolean; error: string | null }[]>("rpc/link_email_identity", {
        method: "POST",
        body: JSON.stringify({ p_user_id: uid, p_email: email }),
      });
      if (!row?.ok) {
        return redirect(req, transaction.returnTo, { emailError: row?.error || "เชื่อมอีเมลไม่สำเร็จ" });
      }
      await linkShopify(uid, email).catch((err) => console.error("[shopify callback] link", err));
      return redirect(req, transaction.returnTo, { emailLinked: email });
    }

    // ── Forgot / change password: the inbox is proven, so issue the same
    //    single-use reset token the emailed link used to carry ────────────
    if (transaction.intent === "reset") {
      const identities = await supabaseRest<{ user_id: string }[]>(
        `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(email)}&select=user_id`
      );
      if (!identities.length) return redirect(req, "/account/forgot-password", { error: "shopify_no_account" });
      const token = randomBytes(32).toString("base64url");
      await supabaseRest("otp_challenges", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          provider: "password_reset",
          target: email,
          code_hash: createHash("sha256").update(token).digest("hex"),
          expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
        }),
      });
      return redirect(req, "/account/change-password/reset", { token });
    }

    // ── Register hit an existing email: apply what they typed, now that
    //    they've shown the inbox is theirs ────────────────────────────────
    if (transaction.intent === "reclaim" && transaction.pending) {
      const [pending] = await supabaseRest<
        { id: string; email: string; display_name: string; phone: string; secret_hash: string; expires_at: string; consumed_at: string | null }[]
      >(
        `pending_account_reclaims?id=eq.${encodeURIComponent(transaction.pending)}&select=id,email,display_name,phone,secret_hash,expires_at,consumed_at`
      );
      const [identity] = await supabaseRest<{ user_id: string }[]>(
        `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(email)}&select=user_id`
      );
      const usable =
        pending &&
        !pending.consumed_at &&
        new Date(pending.expires_at).getTime() > Date.now() &&
        // The proof is for the inbox Shopify just verified — never apply a
        // pending update typed for some other address.
        pending.email === email &&
        identity;
      if (usable) {
        await supabaseRest(`pending_account_reclaims?id=eq.${pending.id}`, {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ consumed_at: new Date().toISOString() }),
        });
        await supabaseRest(`auth_identities?user_id=eq.${identity.user_id}&provider=eq.email`, {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ secret_hash: pending.secret_hash }),
        });
        await supabaseRest(`users?id=eq.${identity.user_id}`, {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ display_name: pending.display_name, phone: pending.phone }),
        });
        await linkShopify(identity.user_id, email).catch((err) => console.error("[shopify callback] link", err));
        const res = redirect(req, transaction.returnTo);
        res.cookies.set(SESSION_COOKIE, createSessionToken(identity.user_id), sessionCookieOptions);
        return res;
      }
      // Expired or mismatched: fall through to a plain sign-in with the
      // email they did prove, rather than a dead end.
    }

    // ── Sign in (or sign up) with the verified email ──────────────────────
    const result = await supabaseRest<{ user_id: string; is_new: boolean }[]>("rpc/find_or_create_email_member", {
      method: "POST",
      body: JSON.stringify({ p_email: email, p_display_name: null }),
    });
    const userId = result[0]?.user_id;
    const isNew = result[0]?.is_new ?? false;
    if (!userId) throw new Error("no user_id from find_or_create_email_member");

    const shopifyCustomerId = await linkShopify(userId, email).catch((err) => {
      console.error("[shopify callback] link", err);
      return null;
    });
    await attributeReferralSignup(req, { newUserId: userId, isNewAccount: isNew, shopifyCustomerId });

    const destination = isNew
      ? `/account/complete-profile?returnTo=${encodeURIComponent(transaction.returnTo)}`
      : transaction.returnTo;
    const res = redirect(req, destination);
    res.cookies.set(SESSION_COOKIE, createSessionToken(userId), sessionCookieOptions);
    return res;
  } catch (err) {
    console.error("[shopify callback]", err);
    return redirect(req, failPath(intent), { error: "shopify_error" });
  }
}

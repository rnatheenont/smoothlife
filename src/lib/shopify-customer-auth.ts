// Server-only: email sign-in through Shopify's Customer Account API.
//
// The site has no email sender it can use for customers (Resend's test
// sender only reaches the account owner, and verifying a domain would touch
// @smoothlife.com). Shopify already sends login codes for this shop's
// customer accounts, so instead of emailing our own OTP we send the customer
// to Shopify's login page: they type their email, Shopify emails the code,
// and Shopify hands back an id_token saying which email was just proven.
// Everything that used to need "a code we emailed" — email login, adding an
// email to an account, reclaiming an account at register, resetting a
// password — hangs off that one proof.
//
// Setup (Shopify admin → Sales channels → Headless → Customer Account API):
// a Client ID, callback https://<site>/api/auth/shopify/callback. Set
// SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID (and _CLIENT_SECRET for a confidential
// client), plus NEXT_PUBLIC_SHOPIFY_EMAIL_LOGIN_ENABLED=1 for the UI.
import { createHash, randomBytes } from "crypto";
import type { ShopifyAuthIntent } from "./shopify-email-login";

export type { ShopifyAuthIntent };

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET;

export const SHOPIFY_AUTH_COOKIE = "sl_shopify_auth";

export const SHOPIFY_AUTH_INTENTS: ShopifyAuthIntent[] = ["login", "link", "reset", "reclaim"];

// NEXT_PUBLIC_SHOPIFY_EMAIL_LOGIN_ENABLED is the one switch: without it the
// server routes (register reclaim, change password) fall back to the old
// emailed-code flows too, not just the buttons — so the credentials can stay
// in Vercel while the feature is off.
export function shopifyEmailAuthConfigured() {
  return Boolean(SHOP && CLIENT_ID && process.env.NEXT_PUBLIC_SHOPIFY_EMAIL_LOGIN_ENABLED);
}

export const shopifyAuthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Same reason as google-auth.ts: Safari drops SameSite=Lax cookies set on
  // the redirect that leaves for the provider.
  sameSite: "none" as const,
  path: "/",
  maxAge: 600, // the customer has to open their inbox, so longer than Google's 5 min
};

type Discovery = { authorization_endpoint: string; token_endpoint: string; issuer: string };
let discoveryCache: { at: number; value: Discovery } | null = null;

async function discovery(): Promise<Discovery> {
  if (discoveryCache && Date.now() - discoveryCache.at < 60 * 60 * 1000) return discoveryCache.value;
  const res = await fetch(`https://${SHOP}/.well-known/openid-configuration`, { cache: "no-store" });
  if (!res.ok) throw new Error(`shopify discovery ${res.status}`);
  const value = (await res.json()) as Discovery;
  discoveryCache = { at: Date.now(), value };
  return value;
}

export type ShopifyAuthTransaction = {
  state: string;
  nonce: string;
  verifier: string;
  intent: ShopifyAuthIntent;
  returnTo: string;
  pending?: string;
};

function base64url(buf: Buffer) {
  return buf.toString("base64url");
}

export async function buildAuthorizeUrl(opts: {
  redirectUri: string;
  intent: ShopifyAuthIntent;
  returnTo: string;
  loginHint?: string | null;
  pending?: string | null;
}): Promise<{ url: string; transaction: ShopifyAuthTransaction }> {
  const { authorization_endpoint } = await discovery();
  const transaction: ShopifyAuthTransaction = {
    state: base64url(randomBytes(16)),
    nonce: base64url(randomBytes(16)),
    verifier: base64url(randomBytes(32)),
    intent: opts.intent,
    returnTo: opts.returnTo,
    ...(opts.pending ? { pending: opts.pending } : {}),
  };
  const url = new URL(authorization_endpoint);
  url.searchParams.set("scope", "openid email customer-account-api:full");
  url.searchParams.set("client_id", CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("nonce", transaction.nonce);
  url.searchParams.set("locale", "th");
  if (opts.loginHint) url.searchParams.set("login_hint", opts.loginHint);
  // PKCE is required for public clients and harmless for confidential ones.
  url.searchParams.set("code_challenge", base64url(createHash("sha256").update(transaction.verifier).digest()));
  url.searchParams.set("code_challenge_method", "S256");
  return { url: url.toString(), transaction };
}

/**
 * Trades the callback's code for tokens and returns the email Shopify just
 * verified. The id_token comes straight from Shopify's token endpoint over
 * TLS in exchange for our own code, so — per OpenID Connect's code flow — its
 * claims are trusted without a JWKS signature check; iss, aud, exp and nonce
 * are still checked so a token minted for another client or login is refused.
 */
export async function exchangeCodeForEmail(opts: {
  code: string;
  redirectUri: string;
  transaction: ShopifyAuthTransaction;
}): Promise<{ email: string; sub: string }> {
  const { token_endpoint, issuer } = await discovery();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID!,
    redirect_uri: opts.redirectUri,
    code: opts.code,
    code_verifier: opts.transaction.verifier,
  });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (CLIENT_SECRET) {
    headers.Authorization = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
  }
  // A string body, not the URLSearchParams itself: passed through Next's
  // patched fetch, the URLSearchParams form hung until the socket timed out.
  const res = await fetch(token_endpoint, { method: "POST", headers, body: body.toString(), cache: "no-store" });
  if (!res.ok) throw new Error(`shopify token exchange ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("shopify token response had no id_token");

  const [, payloadPart] = data.id_token.split(".");
  const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString()) as {
    iss?: string;
    aud?: string | string[];
    exp?: number;
    nonce?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== issuer) throw new Error(`id_token issuer ${claims.iss}`);
  if (!audiences.includes(CLIENT_ID)) throw new Error("id_token audience mismatch");
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("id_token expired");
  if (claims.nonce !== opts.transaction.nonce) throw new Error("id_token nonce mismatch");
  if (!claims.email || claims.email_verified === false) throw new Error("id_token has no verified email");
  return { email: claims.email.trim().toLowerCase(), sub: claims.sub ?? "" };
}

import { NextRequest, NextResponse } from "next/server";
import {
  SHOPIFY_AUTH_COOKIE,
  SHOPIFY_AUTH_INTENTS,
  buildAuthorizeUrl,
  shopifyAuthCookieOptions,
  shopifyEmailAuthConfigured,
  type ShopifyAuthIntent,
} from "@/lib/shopify-customer-auth";

// Only same-site paths — returnTo comes from the query string, and an
// absolute or protocol-relative URL here would make this an open redirect.
function safeReturnTo(value: string | null, fallback: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const intentParam = params.get("intent") as ShopifyAuthIntent | null;
  const intent: ShopifyAuthIntent = intentParam && SHOPIFY_AUTH_INTENTS.includes(intentParam) ? intentParam : "login";
  const returnTo = safeReturnTo(params.get("returnTo"), intent === "link" ? "/account/profile" : "/account");

  if (!shopifyEmailAuthConfigured()) {
    const url = new URL("/account/login", req.url);
    url.searchParams.set("error", "shopify_not_configured");
    return NextResponse.redirect(url);
  }

  try {
    const redirectUri = new URL("/api/auth/shopify/callback", req.url).toString();
    const { url, transaction } = await buildAuthorizeUrl({
      redirectUri,
      intent,
      returnTo,
      loginHint: params.get("hint"),
      pending: params.get("pending"),
    });
    const res = NextResponse.redirect(url);
    res.cookies.set(SHOPIFY_AUTH_COOKIE, JSON.stringify(transaction), shopifyAuthCookieOptions);
    return res;
  } catch (err) {
    console.error("[shopify auth start]", err);
    const url = new URL("/account/login", req.url);
    url.searchParams.set("error", "shopify_error");
    return NextResponse.redirect(url);
  }
}

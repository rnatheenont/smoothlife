// Client-safe half of shopify-customer-auth.ts: whether email codes go
// through Shopify, and how to start that round trip from a page.
export type ShopifyAuthIntent = "login" | "link" | "reset" | "reclaim";

export const SHOPIFY_EMAIL_LOGIN = Boolean(process.env.NEXT_PUBLIC_SHOPIFY_EMAIL_LOGIN_ENABLED);

/**
 * Set after someone signs out, and checked before any silent sign-in attempt.
 * Without it, signing out would last exactly as long as the next page load:
 * the Shopify session is still there, so we would walk them straight back in.
 * Readable from the browser on purpose — the decision is made there.
 */
export const SSO_OPT_OUT_COOKIE = "sl_sso_off";

export function shopifyAuthStartPath(params: {
  intent: ShopifyAuthIntent;
  returnTo?: string;
  hint?: string | null;
  pending?: string | null;
  /** Ask Shopify without ever showing them a page — see the start route. */
  silent?: boolean;
}) {
  const q = new URLSearchParams({ intent: params.intent });
  if (params.returnTo) q.set("returnTo", params.returnTo);
  if (params.hint) q.set("hint", params.hint);
  if (params.pending) q.set("pending", params.pending);
  if (params.silent) q.set("silent", "1");
  return `/api/auth/shopify/start?${q.toString()}`;
}

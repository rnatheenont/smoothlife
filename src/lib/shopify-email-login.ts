// Client-safe half of shopify-customer-auth.ts: whether email codes go
// through Shopify, and how to start that round trip from a page.
export type ShopifyAuthIntent = "login" | "link" | "reset" | "reclaim";

export const SHOPIFY_EMAIL_LOGIN = Boolean(process.env.NEXT_PUBLIC_SHOPIFY_EMAIL_LOGIN_ENABLED);

export function shopifyAuthStartPath(params: {
  intent: ShopifyAuthIntent;
  returnTo?: string;
  hint?: string | null;
  pending?: string | null;
}) {
  const q = new URLSearchParams({ intent: params.intent });
  if (params.returnTo) q.set("returnTo", params.returnTo);
  if (params.hint) q.set("hint", params.hint);
  if (params.pending) q.set("pending", params.pending);
  return `/api/auth/shopify/start?${q.toString()}`;
}

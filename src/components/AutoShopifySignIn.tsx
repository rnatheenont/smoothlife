"use client";

// Signing in without being asked to.
//
// Most of this shop's customers are already signed in at smoothlife.com, and
// Shopify will say who they are without showing them anything — OIDC silent
// authentication, prompt=none. So instead of a signed-in customer arriving here
// as a stranger and having to find a login button, the page asks once and they
// are simply themselves.
//
// It runs in the browser rather than in the proxy on purpose: a crawler never
// executes it, so nothing about how the site is indexed or how fast the first
// page renders changes. When there is no Shopify session to borrow the round
// trip is invisible — the callback sends them back where they were with no
// error, no flash of a login page.
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { SHOPIFY_EMAIL_LOGIN, SSO_OPT_OUT_COOKIE, shopifyAuthStartPath } from "@/lib/shopify-email-login";

/** One attempt per tab. Survives the round trip, gone when the tab is. */
const TRIED_KEY = "sl_sso_tried";

/** Nothing here should ever interrupt a page that is working. */
function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export default function AutoShopifySignIn() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!SHOPIFY_EMAIL_LOGIN) return;
    // Wait for the answer. Attempting while the session is still being read
    // would send a signed-in customer on a pointless round trip.
    if (loading || user) return;

    if (safely(() => sessionStorage.getItem(TRIED_KEY), "1")) return;
    // They signed out. Respect it — see the logout route.
    if (safely(() => document.cookie.includes(`${SSO_OPT_OUT_COOKIE}=1`), true)) return;
    // The paths that are already a conversation about identity run their own
    // flows with their own state cookie; a silent attempt would land on top.
    const path = window.location.pathname;
    if (path.startsWith("/api/") || path.startsWith("/account/complete-profile")) return;

    safely(() => sessionStorage.setItem(TRIED_KEY, "1"), undefined);
    window.location.href = shopifyAuthStartPath({
      intent: "login",
      returnTo: `${path}${window.location.search}`,
      silent: true,
    });
  }, [user, loading]);

  return null;
}

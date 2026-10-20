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
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SHOPIFY_EMAIL_LOGIN, SSO_OPT_OUT_COOKIE, shopifyAuthStartPath } from "@/lib/shopify-email-login";
// Which pages are worth the round trip, and why these three — see sso-paths.
import { wantsIdentity } from "@/lib/sso-paths";

/** One attempt per tab. Survives the round trip, gone when the tab is. */
const TRIED_KEY = "sl_sso_tried";

/**
 * Hosts whose callback address is registered with Shopify.
 *
 * Silent sign-in is a courtesy: it saves an already-signed-in customer from
 * having to find a login button. It is never worth stranding anyone over.
 * But when Shopify does not recognise the redirect_uri it refuses *before*
 * sending the visitor back — the refusal is the sending back — so a round
 * trip that is supposed to be invisible ends with the customer sitting on
 * Shopify's error page, outside the shop, having asked for nothing.
 *
 * That is what a new domain looks like for the hours or days between the DNS
 * record and someone remembering to add the callback in Shopify admin: not
 * "login is broken" but "the site throws you out". So the attempt is only
 * made from a host we know Shopify will answer. A host that is not listed
 * still signs in perfectly well — the customer presses the button, which is
 * what every site did before this component existed.
 *
 * Adding a domain means adding it to Shopify's Callback URIs and to this
 * list, in that order. The list is here rather than in an environment
 * variable because it has to agree with a setting in someone else's console,
 * and a value that must match something unversioned belongs where the next
 * person reading this code will see it.
 *
 * All four are registered with Shopify as of 19 Oct 2026 — the two the shop
 * will live on, the deployment URL it answers on today, and the address it is
 * being tried out at. Registering the ones the shop has not moved to yet
 * costs nothing: a callback address is a string Shopify compares against, and
 * nothing can use one until a host answers at it. It is what turns the move
 * into a DNS change and an environment variable, with no console to revisit
 * on the day.
 */
const SSO_HOSTS = [
  "smoothlife.vercel.app",
  "app.smoothlife.com",
  "smoothlife.com",
  "www.smoothlife.com",
];

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
  // Read through the router rather than window, so a visitor who walks from
  // the home page to their basket without a page load is still offered this.
  // The component lives in the layout and is never remounted by navigation.
  const pathname = usePathname();

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
    const path = pathname ?? window.location.pathname;
    if (path.startsWith("/api/") || path.startsWith("/account/complete-profile")) return;
    if (!wantsIdentity(path)) return;
    // A host Shopify has not been told about — see SSO_HOSTS.
    if (!SSO_HOSTS.includes(window.location.hostname)) return;

    safely(() => sessionStorage.setItem(TRIED_KEY, "1"), undefined);
    window.location.href = shopifyAuthStartPath({
      intent: "login",
      returnTo: `${path}${window.location.search}`,
      silent: true,
    });
  }, [user, loading, pathname]);

  return null;
}

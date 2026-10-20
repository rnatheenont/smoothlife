/**
 * Which pages of this app are allowed to be found in search, and where.
 *
 * The app answers on hosts that must stay out of Google — every product and
 * collection here is the same copy that already ranks on www.smoothlife.com,
 * and two sites competing with one shop's words is a fight neither wins. So
 * the default is still "nothing is indexable" (src/proxy.ts).
 *
 * The FAQ is the exception, and the only one. Those answers exist nowhere
 * else: www has no page like them, so letting them be found adds something
 * to the shop's presence instead of splitting it. That is the whole of
 * option B — open the one part that is not a duplicate, leave the rest shut.
 *
 * Two conditions, not one. A path is indexable only on the host the canonical
 * tags name, because a preview deployment serving the same /faq is a second
 * copy of the page we just asked Google to rank, which is the duplicate this
 * file exists to prevent.
 */

/** Pages that may be indexed. Everything else on this app may not. */
export function indexablePath(pathname: string): boolean {
  return pathname === "/faq" || pathname.startsWith("/faq/");
}

/**
 * The hostname canonical tags point at, or null when there is not one yet.
 *
 * Null while NEXT_PUBLIC_SITE_URL is unset or still a *.vercel.app name —
 * the same guard movedHost uses, and for the same reason: until the variable
 * names a real custom domain there is no host whose /faq is the original, so
 * nothing should be opened to search. This file can therefore ship before
 * that variable is set and do nothing at all until it is.
 */
export function canonicalHost(): string | null {
  const home = process.env.NEXT_PUBLIC_SITE_URL;
  if (!home || home.includes(".vercel.app")) return null;
  try {
    return new URL(home).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Whether this exact request may be indexed — the path is one of the open
 *  ones *and* it arrived on the host the canonical tags name. */
export function indexableRequest(host: string | null, pathname: string): boolean {
  if (!host) return false;
  const canonical = canonicalHost();
  if (!canonical) return false;
  // A port on the host header is not part of the name.
  return host.split(":")[0].toLowerCase() === canonical && indexablePath(pathname);
}

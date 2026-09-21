/**
 * Where this application is served.
 *
 * It is not www.smoothlife.com. That address serves the Shopify theme, and
 * none of this app's routes exist there — /concern/acne and
 * /knowledge/questions both answer 404 on it. Pointing canonical tags, the
 * sitemap, LINE messages and referral links at a host that 404s them is worse
 * than pointing them anywhere else, because each one is a promise that the
 * real page lives there.
 *
 * So the default is the origin the app actually answers on. Set
 * NEXT_PUBLIC_SITE_URL when that changes — moving to a custom domain is then
 * one environment variable, not a hunt through seven files.
 *
 * Note for anyone wondering why the demo is invisible to Google: every
 * *.vercel.app response carries X-Robots-Tag: noindex (see src/proxy.ts), on
 * purpose, so a demo cannot compete with the real shop in search results.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smoothlife.vercel.app";

/**
 * The Shopify storefront — a different site, for linking to pages this app
 * has no route of its own for. Kept apart from SITE_URL because the two used
 * to share one variable, which meant pointing the app at its own origin
 * silently redirected every Shopify fallback link to a page that does not
 * exist here.
 */
export const SHOPIFY_STOREFRONT_ORIGIN =
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ORIGIN || "https://www.smoothlife.com";

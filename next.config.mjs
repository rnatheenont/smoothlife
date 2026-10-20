import { CSP, CSP_PAYMENT, CSP_HEADER, SEND_CSP, PAYMENT_PATHS } from "./csp.mjs";

// The policy itself, and why each origin is in it, lives in ./csp.mjs.
//
// Two policies, never both on one page: Next sends every matching rule's
// headers, and two Content-Security-Policy headers on one response are
// intersected by the browser — the looser payment policy would have no effect
// at all if the ordinary one still matched the same path. So the two sources
// below are built from one list of payment paths and are exact opposites of
// each other: every path gets one of them, and no path gets both.
const PAYMENT_PREFIXES = PAYMENT_PATHS.map((p) => p.replace(/^\//, "")).join("|");
const PAYMENT_SOURCE = `/:path((?:${PAYMENT_PREFIXES}).*)`;
const ORDINARY_SOURCE = `/:path((?!${PAYMENT_PREFIXES}).*)`;

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.SUPABASE_URL || "").origin;
  } catch {
    return "https://jazxokmkcuxvllpycdcd.supabase.co";
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.smoothlife.com" },
      { protocol: "https", hostname: "smoothlife.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Product photographs uploaded through the admin (see product-images.ts).
      // `unoptimized` below means remotePatterns is not consulted today, but a
      // host missing from this list is what breaks the day it is turned off.
      { protocol: "https", hostname: new URL(SUPABASE_ORIGIN).hostname },
    ],
    // Vercel's Image Optimization has a monthly transformation quota on the
    // current plan; the catalogue's product photos already come pre-resized
    // from Shopify's own CDN (`?width=...`), so routing them through
    // Vercel's optimizer too was pure overhead — and once the quota was
    // exceeded, new (uncached) images started failing with 402 instead of
    // rendering. Serving originals directly removes that failure mode.
    unoptimized: true,
  },
  // The campaigns console moved from /admin/receipts to /admin/campaigns, to
  // match the /campaigns/<key> addresses it manages. The old path is in the
  // team's bookmarks and browser history, so it answers rather than 404s.
  // Temporary (307), not permanent: a 308 is cached by the browser forever and
  // would outlive the rename if the path is ever wanted back.
  async redirects() {
    return [
      { source: "/admin/receipts", destination: "/admin/campaigns", permanent: false },
      // The FAQ centre took over from /knowledge/questions. Permanent (308)
      // this time, and safely so: no question had a public_slug until today,
      // so there is no indexed /knowledge/questions/<slug> for a browser to
      // cache a redirect away from — unlike /admin/receipts above, where a
      // 308 would outlive the rename.
      { source: "/knowledge/questions", destination: "/faq", permanent: true },
      { source: "/knowledge/questions/:slug", destination: "/faq/:slug", permanent: true },
    ];
  },
  async headers() {
    return [
      // The live skin scan's face model and WASM runtime (~7 MB compressed
      // together) don't change between deploys of the same package version,
      // so a returning scanner shouldn't have to revalidate them each visit.
      // A day, not forever: the filenames aren't content-hashed.
      {
        source: "/:dir(models|mediapipe)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      // The worker itself is never cached: a stale copy of the thing that
      // decides what is cached takes a deploy to notice and a hard refresh to
      // clear, on every phone that has it.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera for this site only: the Skin Coach live scan opens it in the
          // page. Other sites framed here, and the microphone and location,
          // stay off.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      ...(SEND_CSP
        ? [
            { source: ORDINARY_SOURCE, headers: [{ key: CSP_HEADER, value: CSP }] },
            { source: PAYMENT_SOURCE, headers: [{ key: CSP_HEADER, value: CSP_PAYMENT }] },
          ]
        : []),
    ];
  },
};

export default nextConfig;

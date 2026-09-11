/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.smoothlife.com" },
      { protocol: "https", hostname: "smoothlife.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // Vercel's Image Optimization has a monthly transformation quota on the
    // current plan; the catalogue's product photos already come pre-resized
    // from Shopify's own CDN (`?width=...`), so routing them through
    // Vercel's optimizer too was pure overhead — and once the quota was
    // exceeded, new (uncached) images started failing with 402 instead of
    // rendering. Serving originals directly removes that failure mode.
    unoptimized: true,
  },
  // A real Content-Security-Policy needs every external origin this app
  // actually calls (LINE/Google/Apple OAuth, 2C2P payment iframe, Firework
  // video CDN, Shopify, Supabase, Anthropic) enumerated correctly first —
  // guessing one risks silently breaking login or checkout, so it's left
  // for a follow-up done with that inventory in hand. These four don't
  // carry that risk: none change what origins the app is allowed to talk
  // to, they only stop this site's own pages from being clickjacked,
  // MIME-sniffed, over-sharing referrers, or having device APIs used
  // without asking.
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
    ];
  },
};

export default nextConfig;

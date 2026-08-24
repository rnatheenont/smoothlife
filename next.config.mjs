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
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

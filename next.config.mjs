// Content-Security-Policy, in REPORT-ONLY mode: browsers load everything as
// before and only report what this policy would have blocked, to
// /api/csp-report (stored in the csp_reports table). Once a week or two of
// real traffic shows no legitimate origin is missing, switch the header name
// to Content-Security-Policy to enforce it.
//
// Origins, by what uses them:
//   Shopify CDN, smoothlife.com CDN, Unsplash — product, banner and article images
//   Supabase storage — signed URLs for skin-scan photos and chat attachments
//   Google / LINE profile pictures — account avatars
//   Firebase Auth + reCAPTCHA (Google) — phone-number OTP login
//   LINE LIFF SDK — the in-LINE app at /liff
//   2C2P — the payment page shown in an iframe
//   Firework CDN — product videos
//   Vercel Analytics / Speed Insights
// 'unsafe-inline' scripts: Next.js inlines its bootstrap and JSON-LD; a nonce
// would force every page dynamic and lose the edge cache. 'wasm-unsafe-eval':
// the skin scan's MediaPipe runtime.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.SUPABASE_URL || "").origin;
  } catch {
    return "https://jazxokmkcuxvllpycdcd.supabase.co";
  }
})();

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.google.com https://www.gstatic.com https://apis.google.com https://static.line-scdn.net https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://cdn.shopify.com https://www.smoothlife.com https://smoothlife.com https://images.unsplash.com ${SUPABASE_ORIGIN} https://*.googleusercontent.com https://profile.line-scdn.net https://*.line-scdn.net https://www.gstatic.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://www.google.com https://api.line.me https://*.line-scdn.net https://liffsdk.line-scdn.net https://vitals.vercel-insights.com`,
  "media-src 'self' blob: https://*.fireworktv.com",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.2c2p.com https://www.google.com https://recaptcha.google.com https://*.firebaseapp.com",
  "form-action 'self' https://*.2c2p.com https://access.line.me https://accounts.google.com https://appleid.apple.com https://shopify.com https://*.shopify.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // report-uri only: Chrome ignores report-uri whenever report-to is also
  // present, and its batched Reporting API delivery never arrived in testing,
  // while report-uri is sent straight away by Chrome, Safari and Firefox.
  "report-uri /api/csp-report",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;

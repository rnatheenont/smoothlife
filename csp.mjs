// The Content-Security-Policy, built here rather than inline in next.config
// so the two shapes of it — the ordinary one and the one payment pages need —
// are written side by side and share every other directive.
//
// Still REPORT-ONLY: browsers load everything as before and only report what
// this policy would have blocked, to /api/csp-report (the csp_reports table).
// Enforcing it means changing HEADER below to "Content-Security-Policy", and
// that should only happen after a week or two in which the table collects
// nothing new (see the checks at the bottom of this comment).
//
// Origins, by what uses them:
//   Shopify CDN, smoothlife.com CDN, Unsplash — product, banner and article images
//   Supabase storage — signed URLs for skin-scan photos and chat attachments
//   Google / LINE profile pictures — account avatars
//   Firebase Auth + reCAPTCHA (Google) — phone-number OTP login
//   LINE LIFF SDK — the in-LINE app at /liff
//   2C2P — the payment page shown in an iframe
//   Firework CDN — product videos
//   YouTube (nocookie) / Vimeo / Facebook / TikTok / Instagram — videos in a
//     product's own content blocks
//   Shopify CDN / smoothlife.com / Supabase storage — video files in those
//     same blocks, played in a <video> tag rather than a third-party player
//   Vercel Analytics / Speed Insights
//   Google Tag Manager — the team's container (NEXT_PUBLIC_GTM_ID). GTM loads
//     gtm.js from googletagmanager.com and whatever tags the container holds.
//     The GA4 tag beacons to google-analytics.com, to the regional collector
//     region1.google-analytics.com, and to analytics.google.com; the Google
//     Ads tag loads its conversion script from googleads.g.doubleclick.net and
//     pings doubleclick, googleadservices and the visitor's own Google domain.
//     Those last ones are why www.google.com and www.google.co.th are here:
//     Ads sends the conversion pixel to whichever Google domain the visitor
//     belongs to, so a shopper outside Thailand (google.com.hk was seen once)
//     still loses that one ping. The purchase itself is recorded server-side,
//     so what is lost is an ad-platform signal, not an order.
// 'unsafe-inline' scripts: Next.js inlines its bootstrap and JSON-LD; a nonce
// would force every page dynamic and lose the edge cache. 'wasm-unsafe-eval':
// the skin scan's MediaPipe runtime.
//
// Two things deliberately stay out:
//   • The Vercel toolbar (vercel.live, vercel.com) — allowed on preview and
//     local builds only, never on the live site, where nobody should be
//     loading it. It was 24,800 of the 25,900 reports collected since 15 Sep.
//   • Google Translate and the Facebook in-app browser (translate.google.com,
//     fonts.gstatic.com, www.gstatic.com stylesheets, connect.facebook.net).
//     Those come from the visitor's own browser, not from this site; blocking
//     them stops nothing the site does.
//
// Checking whether it is safe to enforce — the table keeps counting into the
// same row, so look at last_seen, not count:
//   select blocked, directive, page, count, last_seen from csp_reports
//   where last_seen > '<the day this deployed>' order by last_seen desc;

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.SUPABASE_URL || "").origin;
  } catch {
    return "https://jazxokmkcuxvllpycdcd.supabase.co";
  }
})();

/** The live site. Preview deployments and `next dev` are not it. */
const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

/** The toolbar Vercel injects into preview deployments. */
const VERCEL_TOOLBAR = IS_PRODUCTION
  ? { script: "", frame: "", font: "", img: "", connect: "" }
  : {
      script: " https://vercel.live",
      frame: " https://vercel.live",
      font: " https://vercel.live",
      img: " https://vercel.live https://vercel.com",
      connect: " https://vercel.live wss://vercel.live",
    };

// www.google.com is in here rather than listed separately because both
// users of it — reCAPTCHA during phone login and the Ads conversion pixel —
// want it in connect-src, and the pixel also wants it in img-src.
const GOOGLE_ADS = "https://*.doubleclick.net https://www.googleadservices.com https://www.google.com https://www.google.co.th";

/**
 * Everything except frame-src, which the two policies disagree about.
 */
const SHARED = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.google.com https://www.gstatic.com https://apis.google.com https://static.line-scdn.net https://va.vercel-scripts.com https://www.googletagmanager.com https://www.google-analytics.com https://*.doubleclick.net${VERCEL_TOOLBAR.script}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://cdn.shopify.com https://www.smoothlife.com https://smoothlife.com https://images.unsplash.com ${SUPABASE_ORIGIN} https://*.googleusercontent.com https://profile.line-scdn.net https://*.line-scdn.net https://www.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com ${GOOGLE_ADS}${VERCEL_TOOLBAR.img}`,
  `font-src 'self' data:${VERCEL_TOOLBAR.font}`,
  `connect-src 'self' ${SUPABASE_ORIGIN} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://api.line.me https://*.line-scdn.net https://liffsdk.line-scdn.net https://vitals.vercel-insights.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://cdn.shopify.com https://www.smoothlife.com ${GOOGLE_ADS}${VERCEL_TOOLBAR.connect}`,
  `media-src 'self' blob: https://*.fireworktv.com https://cdn.shopify.com https://www.smoothlife.com https://smoothlife.com ${SUPABASE_ORIGIN}`,
  "worker-src 'self' blob:",
  "form-action 'self' https://*.2c2p.com https://access.line.me https://accounts.google.com https://appleid.apple.com https://shopify.com https://*.shopify.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // report-uri only: Chrome ignores report-uri whenever report-to is also
  // present, and its batched Reporting API delivery never arrived in testing,
  // while report-uri is sent straight away by Chrome, Safari and Firefox.
  "report-uri /api/csp-report",
];

// googletagmanager: the <noscript> iframe, and GTM's own preview mode.
const FRAME_SRC = `frame-src 'self' https://www.googletagmanager.com https://*.2c2p.com https://www.google.com https://recaptcha.google.com https://*.firebaseapp.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.facebook.com https://www.tiktok.com https://www.instagram.com${VERCEL_TOOLBAR.frame}`;

// Card payment is the one place this list cannot be written down. 2C2P's page
// opens inside an iframe here, and then sends itself to the card issuer's 3-D
// Secure page — a different domain for every bank (uobt3dsg2.uobgroup.com and
// authentication.cardinalcommerce.com both turned up on /flash-sale pages in
// September, from two cards), sometimes by way of a data: URL. Enforcing the
// list above on those pages would refuse the OTP step and fail the payment,
// for banks nobody has tested yet most of all.
//
// So the payment pages get any https frame instead of a list. It is the
// weakest directive in the policy and the one that matters least: frame-src
// does not let anything run in this page, and script-src — which does — stays
// exactly as strict here as everywhere else.
const PAYMENT_FRAME_SRC = "frame-src 'self' https: data:";

/**
 * Paths that can open the 2C2P payment iframe (PaymentModal). They are
 * prefixes, not exact paths: "/flash-sale" also covers /flash-sale/<id> and
 * /flash-sale-demo, which opens the same modal.
 */
export const PAYMENT_PATHS = [
  "/checkout",
  "/flash-sale",
  "/admin/flash-sale/demo",
  "/admin/design/payment",
];

/**
 * Report-only for now. One name, one place to change when it is enforced.
 */
export const CSP_HEADER = "Content-Security-Policy-Report-Only";

export const CSP = [...SHARED, FRAME_SRC].join("; ");
export const CSP_PAYMENT = [...SHARED, PAYMENT_FRAME_SRC].join("; ");

/**
 * `next dev` compiles with eval, and its hot reload opens a websocket; both
 * are blocked by this policy and neither exists in a real build. They were
 * 13,300 of the reports collected since 15 September — enough noise to hide
 * whatever real violation arrives next. The policy is verified on preview
 * deployments, which are production builds, so nothing is lost by leaving the
 * header off while developing.
 */
export const SEND_CSP = process.env.NODE_ENV === "production";

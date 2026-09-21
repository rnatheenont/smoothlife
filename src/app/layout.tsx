import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import SiteChrome from "@/components/SiteChrome";
import { organizationJsonLd, websiteJsonLd, jsonLdScript } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/site-url";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import OldBrowserNotice from "@/components/OldBrowserNotice";

// Noto Sans Thai, self-hosted through next/font so there is no request to
// Google at page load and no layout shift when it arrives. Loaded as the
// variable font rather than a list of weights: the old list stopped at 700,
// so every font-extrabold on the site was a browser-synthesised fake bold.
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-thai",
  display: "swap",
});

const SITE_TITLE = "Smoothlife.com — สุขภาพและความงามครบวงจร";
const SITE_DESCRIPTION =
  "Smoothlife.com ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม ช้อปง่าย ครบจบทุก lifestyle ที่เดียว";

// /logo.webp is a wide logo lockup (440×68), not a proper social-share
// banner — LINE/Facebook previews will show it small/cropped rather than a
// real 1200×630 image. Works as a functional placeholder (every page now
// has *some* preview image instead of none), but a dedicated OG banner
// would look meaningfully better here.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Smoothlife.com",
    locale: "th_TH",
    type: "website",
    images: [{ url: "/logo.webp", width: 440, height: 68 }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/logo.webp"],
  },
  // Search Console proves ownership by finding a token it gave you in the
  // page head. It lives in an environment variable rather than here so
  // claiming the site — or re-claiming it after someone leaves the team — is
  // a deploy, not a code change and a review.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

// viewport-fit=cover lets iOS report real env(safe-area-inset-*) values
// (e.g. the bottom tab bar's padding) instead of always 0 — without it the
// safe-area padding silently does nothing on notched/home-indicator devices.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#00a87b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={notoSansThai.variable}>
      <body className="min-h-screen flex flex-col antialiased font-sans">
        <OldBrowserNotice />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd()) }} />
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

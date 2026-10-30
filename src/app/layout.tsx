import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import SiteChrome from "@/components/SiteChrome";
import { menuCategories } from "@/data/nav-menu";
import { tickerProducts } from "@/lib/ticker-products";
import { organizationJsonLd, websiteJsonLd, jsonLdScript } from "@/lib/json-ld";
import { SITE_URL, SHOPIFY_STOREFRONT_ORIGIN } from "@/lib/site-url";
// Shared with /lib/site-pages so the home page and the tab title can never
// drift apart — the page there overrides this one only when the team edits it.
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site-pages";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GoogleTagManager from "@/components/GoogleTagManager";
import { footerColumns } from "@/lib/pages/footer-links-server";
import { announcement } from "@/lib/pages/announcement-server";
import { mobileTabs } from "@/lib/pages/mobile-tabs-server";
import { headerLinks } from "@/lib/pages/header-links-server";
import { announcementVisible } from "@/lib/pages/announcement";
import AnnouncementBar from "@/components/AnnouncementBar";
import OldBrowserNotice from "@/components/OldBrowserNotice";
import { MascotThemeProvider } from "@/components/mascot/mascot-theme-context";
import { mascotThemeSetting } from "@/lib/mascot-theme-server";

// Noto Sans Thai, self-hosted through next/font so there is no request to
// Google at page load and no layout shift when it arrives. Loaded as the
// variable font rather than a list of weights: the old list stopped at 700,
// so every font-extrabold on the site was a browser-synthesised fake bold.
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-thai",
  display: "swap",
});


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
    // No `images` here on purpose: opengraph-image.png beside this file is
    // the site's card, and it applies to every route that does not bring its
    // own. What used to be here was the header logo — 440x68 of wordmark,
    // which every preview cropped to three letters.
  },
  twitter: {
    // Large, because the card is a 1200x630 picture rather than a thumbnail.
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  // iOS does not read the manifest. Added to a home screen from Safari, this
  // is where it finds the icon and the name under it, and what tells it to
  // open the shop without Safari's own chrome around it.
  appleWebApp: {
    capable: true,
    title: "Smoothlife",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // Search Console and Bing Webmaster Tools both prove ownership by finding
  // a token they gave you in the page head. They live in environment
  // variables rather than here so claiming the site — or re-claiming it
  // after someone leaves the team — is a deploy, not a code change and a
  // review.
  //
  // Neither is needed when the domain is verified by DNS instead, which is
  // the plan for smoothlife.com: a TXT record covers www, app and campaign
  // at once, where a meta tag claims one host. These stay for the case where
  // the DNS record is somebody else's to add.
  ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION
    ? {
        verification: {
          ...(process.env.GOOGLE_SITE_VERIFICATION
            ? { google: process.env.GOOGLE_SITE_VERIFICATION }
            : {}),
          ...(process.env.BING_SITE_VERIFICATION
            ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
            : {}),
        },
      }
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read here, on the server, and handed down — see SiteShell's note. The
  // read is cached under the footer document's own tag, so this is one entry
  // for the whole site rather than a query per page.
  const footerCols = await footerColumns();
  // Decided here, where the clock is the server's: a bar with a window has
  // to agree with the HTML it was sent in.
  const bar = await announcement();
  const tabs = await mobileTabs();
  const navLinks = await headerLinks();
  // Smoothie's outfit, chosen in /admin/mascot.
  const mascotSetting = await mascotThemeSetting();
  const announcementNode = announcementVisible(bar, new Date()) ? <AnnouncementBar bar={bar} /> : null;
  return (
    <html lang="th" className={notoSansThai.variable}>
      <head>
        {/* Every product photo and every banner on this site comes from
        Shopify's CDN — 213 references on the home page alone — and the first
        one of them paid for the DNS lookup, the TCP handshake and the TLS
        negotiation before a single byte of image arrived. On a throttled
        phone connection that is most of a second spent before the largest
        image on the page has started.

        Two hosts because the catalogue and the banners are stored under
        different ones, and the hero is served from the storefront's. */}
        <link rel="preconnect" href="https://cdn.shopify.com" crossOrigin="" />
        <link rel="preconnect" href={SHOPIFY_STOREFRONT_ORIGIN} crossOrigin="" />
      </head>
      <body className="min-h-screen flex flex-col antialiased font-sans">
        <OldBrowserNotice />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd()) }} />
        <MascotThemeProvider setting={mascotSetting}>
        <Providers tabs={tabs}>
          <SiteChrome
          ticker={tickerProducts()}
          menu={menuCategories}
          footerColumns={footerCols}
          announcement={announcementNode}
          headerLinks={navLinks}
        >
            {children}
          </SiteChrome>
        </Providers>
        </MascotThemeProvider>
        <Analytics />
        <SpeedInsights />
        <GoogleTagManager />
      </body>
    </html>
  );
}

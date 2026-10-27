"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import type { TickerProduct } from "@/lib/ticker-products";
import type { MenuCategory } from "@/data/nav-menu";
import type { FooterColumns } from "@/lib/pages/footer-links";
import type { HeaderLinks } from "@/lib/pages/header-links";
import type { ReactNode as AnnouncementSlot } from "react";
import Footer from "@/components/Footer";

// The back office is its own application: it brings its own header, its own
// navigation and its own footer-less full-height layout, so the storefront's
// promo bar, menu, footer and mobile tab-bar spacer stop wrapping it.
// (StorefrontWidgets in Providers already keeps the chat bubble and the tab
// bar off /admin for the same reason.)
//
// /chat is bare for a different reason: it is a full-height app screen whose
// input sits on the bottom edge. A promo bar above it and a footer below
// would leave the conversation a letterbox in the middle of the page.
//
// /campaigns is bare because it is not wearing this site at all: a campaign
// link goes to people who know the shop as smoothlife.com and have never seen
// this one, so those pages bring the store's own header and footer. Two
// headers, one of them belonging to a site that has not launched, is exactly
// the impression a promotion cannot afford to make.
// A flash-sale page is handed out the same way a campaign is — a LINE
// broadcast, a story, a QR code — and a "special" one is a campaign in all but
// the table it lives in. Which chrome it wears depends on the campaign row, not
// on the URL, so the decision moves down to src/app/flash-sale/[id]/layout.tsx
// where that row can be read. Both branches are here for it to pick from.
// The pages a campaign sign-up passes through on the way back from Shopify
// belong to whichever journey sent them, so they decide too — in
// src/components/campaign/CampaignChrome.tsx, which can read returnTo.
const BARE = ["/admin", "/chat", "/campaigns", "/flash-sale", "/account/complete-profile", "/account/login"];

/** Exactly this path or something under it — never /flash-sale-demo. */
const isUnder = (pathname: string | null, base: string) =>
  pathname === base || Boolean(pathname?.startsWith(`${base}/`));

/** This site's own header and footer, for whoever still wants them. */
export function SiteShell({
  children,
  ticker = [],
  menu = [],
  footerColumns,
  announcement,
  headerLinks,
}: {
  children: ReactNode;
  ticker?: TickerProduct[];
  /** The announcement bar, already decided and already rendered by the
   *  layout. A node rather than its settings: whether it shows depends on
   *  the clock, and that belongs on the server — a client component that
   *  checks the time disagrees with the HTML it was sent. */
  announcement?: AnnouncementSlot;
  /** The footer's link columns, read on the server. Same reason as `menu`. */
  footerColumns?: FooterColumns;
  /** The header's own navigation, read on the server. Same reason again. */
  headerLinks?: HeaderLinks;
  /** The shop menu, built on the server. It arrives as a prop rather than as
   *  an import because building it reads the whole catalogue, and a client
   *  component that imports it drags all ~1,000 products into the browser —
   *  on every page, for a menu of six categories. */
  menu?: MenuCategory[];
}) {
  return (
    <>
      {/* First thing a keyboard reaches, and invisible until it does. Without
          it, getting to the page means tabbing through the announcement, the
          ticker, the search box and a nav bar — on every page, every time. */}
      <a
        href="#main"
        className="skip-link rounded-xl2 bg-brand-800 px-4 py-2 text-sm font-semibold text-white shadow-cardHover"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      {announcement}
      <Header ticker={ticker} menu={menu} />
      {/* tabIndex -1 so following the link moves focus here, not just the
          scroll position — otherwise the next Tab goes back to the header. */}
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer columns={footerColumns} />
      <div className="h-[60px] lg:hidden" aria-hidden />
    </>
  );
}

export default function SiteChrome({
  children,
  ticker,
  menu,
  footerColumns,
  announcement,
  headerLinks,
}: {
  children: ReactNode;
  ticker: TickerProduct[];
  menu: MenuCategory[];
  footerColumns?: FooterColumns;
  announcement?: AnnouncementSlot;
  headerLinks?: HeaderLinks;
}) {
  const pathname = usePathname();
  if (BARE.some((p) => isUnder(pathname, p))) return <>{children}</>;
  return (
    <SiteShell
      ticker={ticker}
      menu={menu}
      footerColumns={footerColumns}
      announcement={announcement}
      headerLinks={headerLinks}
    >
      {children}
    </SiteShell>
  );
}

"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
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
const BARE = ["/admin", "/chat", "/campaigns"];

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (BARE.some((p) => pathname?.startsWith(p))) return <>{children}</>;

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <div className="h-[60px] lg:hidden" aria-hidden />
    </>
  );
}

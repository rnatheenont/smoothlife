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
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return <>{children}</>;

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <div className="h-[60px] lg:hidden" aria-hidden />
    </>
  );
}

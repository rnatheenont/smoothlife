import type { ReactNode } from "react";
import { StoreHeader, StoreFooter } from "@/components/campaign/StoreChrome";

// Campaign pages are handed out by link — from LINE, a post, a QR on a shelf —
// and nothing on this site points at them. They stay out of search for the same
// reason /flash-sale does: this site has not launched, and a promotion found by
// a stranger through Google, on a domain the shop has never announced, is a
// promotion that looks fake. "/campaigns/" is in robots.ts as well; this is the
// half crawlers that ignore robots.txt still read.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function CampaignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </div>
  );
}

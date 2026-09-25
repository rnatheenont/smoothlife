import type { ReactNode } from "react";
import { StoreHeader, StoreFooter } from "@/components/campaign/StoreChrome";
import { SiteShell } from "@/components/SiteChrome";
import { StorefrontWidgets } from "@/components/Providers";

// Chrome for the account pages that sit in the middle of a campaign sign-up.
//
// A campaign visitor signs in at Shopify and comes back here to finish their
// profile — a page of this site, in the middle of a journey that has so far
// only ever shown them smoothlife.com. This site has not launched, so its
// header and footer appearing at that exact moment is the same problem
// /campaigns was built to avoid, one step further along: an unfamiliar shop
// asking a stranger for their name, phone number and address.
//
// Where they are going is what decides it. The whole chain carries returnTo
// from the campaign page to Shopify and back, so the page can tell a campaign
// sign-up from someone registering on this storefront, and each gets the
// chrome it belongs in.
//
// The page reads returnTo on the server and tells this component the answer.
// Reading it here instead would mean reading it in the browser: these pages
// prerender, so the HTML would go out wearing the wrong shop and swap after
// hydration — a flash of the site that has not launched, which is the whole
// thing being avoided.
/** returnTo as the page was given it — one value, or none. */
export function returnToOf(searchParams: Record<string, string | string[] | undefined>): string | null {
  const raw = searchParams.returnTo;
  return (Array.isArray(raw) ? raw[0] : raw) ?? null;
}

export function isCampaignReturn(returnTo: string | null | undefined): boolean {
  // Only our own paths: "//evil.example" and "https://…" are somebody else's
  // site, and a destination we would not send anyone to is not a campaign.
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) return false;
  const path = returnTo.split(/[?#]/)[0];
  // /flash-sale is here because a special sale is a campaign wearing the
  // store's chrome (see src/app/flash-sale/[id]/layout.tsx) and only the
  // campaign row says which kind it is — not something the browser can read.
  // A regular sale of this storefront is the one case this gets wrong, and it
  // errs towards the shop the customer already knows.
  return ["/campaigns", "/flash-sale"].some((base) => path === base || path.startsWith(`${base}/`));
}

export default function CampaignChrome({ campaign, children }: { campaign: boolean; children: ReactNode }) {
  if (campaign) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <StoreHeader />
        <main className="flex-1">{children}</main>
        <StoreFooter />
      </div>
    );
  }
  return (
    <>
      <SiteShell>{children}</SiteShell>
      <StorefrontWidgets />
    </>
  );
}

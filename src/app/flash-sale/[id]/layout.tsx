import type { ReactNode } from "react";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { UUID_RE } from "@/lib/flash-sale";
import { StoreHeader, StoreFooter } from "@/components/campaign/StoreChrome";
import { SiteShell } from "@/components/SiteChrome";
import { StorefrontWidgets } from "@/components/Providers";

// Which shop a sale page appears to belong to.
//
// A "special" campaign is a campaign: the link goes out to people who know the
// shop as smoothlife.com and have never seen this site, so the page wears the
// store's header and footer and nothing of this one — same reasoning, and the
// same components, as /campaigns. A regular flash sale is a page of this
// storefront and keeps its chrome.
//
// The choice is a property of the campaign row, so it is made here rather than
// in SiteChrome, which only ever sees a URL. SiteChrome and StorefrontWidgets
// stand down for everything under /flash-sale/ and this layout puts back
// whichever half belongs.

export const dynamic = "force-dynamic";

async function isSpecial(id: string): Promise<boolean> {
  if (!UUID_RE.test(id) || !supabaseConfigured()) return false;
  try {
    const rows = await supabaseRest<{ kind: string }[]>(
      `flash_sale_campaigns?id=eq.${pgValue(id)}&select=kind&limit=1`
    );
    return rows[0]?.kind === "special";
  } catch {
    // An unreachable database is not a reason to show the wrong shop's header;
    // the page below will fail its own way.
    return false;
  }
}

export default async function FlashSaleCampaignLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  if (await isSpecial((await params).id)) {
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

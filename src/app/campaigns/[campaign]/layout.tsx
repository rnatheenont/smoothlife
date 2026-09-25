import type { CSSProperties, ReactNode } from "react";
import { StoreHeader, StoreFooter } from "@/components/campaign/StoreChrome";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";

// The chrome sits here rather than one level up because "กลับไปหน้าร้าน" is a
// per-campaign answer: DENTISTE'S x KENG NAMPING leads back to the DENTISTE'
// shelf, and the next campaign will lead somewhere else. That link is part of
// the campaign's settings, so the layout that reads the campaign key renders
// the header.

export const dynamic = "force-dynamic";

export default async function CampaignChromeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campaign: string }>;
}) {
  const { storeUrl, accent } = await loadCampaignContent(campaignKeyFrom((await params).campaign));
  return (
    // Five shades from one setting: the accent itself for fills, a darkened
    // one for type, a wash for chips and icon circles, and the faintest of
    // all behind the whole page. The cards are white so they still lift off
    // it — a tint everywhere and nothing on top of it is just a grey page.
    <div
      className="flex min-h-dvh flex-col bg-[var(--rc-page)]"
      style={
        {
          "--rc-accent": accent,
          "--rc-ink": `color-mix(in oklab, ${accent} 78%, black)`,
          "--rc-wash": `color-mix(in oklab, ${accent} 10%, white)`,
          "--rc-page": `color-mix(in oklab, ${accent} 5%, white)`,
          "--rc-line": `color-mix(in oklab, ${accent} 40%, white)`,
        } as CSSProperties
      }
    >
      <StoreHeader storeUrl={storeUrl} />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </div>
  );
}

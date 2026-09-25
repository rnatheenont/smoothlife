import type { ReactNode } from "react";
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
  const { storeUrl } = await loadCampaignContent(campaignKeyFrom((await params).campaign));
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <StoreHeader storeUrl={storeUrl} />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </div>
  );
}

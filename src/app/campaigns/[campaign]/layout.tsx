import type { CSSProperties, ReactNode } from "react";
import { StoreHeader, StoreFooter } from "@/components/campaign/StoreChrome";
import { ShaderBackground } from "@/components/ui/portfolio-tester";
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
  const { storeUrl, accent, shaderBackground } = await loadCampaignContent(
    campaignKeyFrom((await params).campaign),
  );
  return (
    // Four shades from one setting: the accent itself for fills, a darkened
    // one for type, a wash for chips, icon circles and the upload area, and a
    // lighter line for its border. The page behind them stays white — the
    // colour is for the things worth pointing at, not the paper.
    //
    // Unless a campaign asks for the gradient, in which case the paper becomes
    // an actual sheet: the copy here is set straight on the page, so filling
    // the page with a moving gradient would put every paragraph on top of one.
    // The sheet keeps the reading surface white and lets the gradient have the
    // margins instead.
    <div
      className={
        shaderBackground
          ? // The chrome goes translucent so the gradient is one field the page
            // sits in, rather than a strip of colour between two white bars.
            // Overridden from here because StoreHeader/StoreFooter are shared
            // with /flash-sale, which has no gradient to show through them.
            "relative flex min-h-dvh flex-col " +
            "[&_header]:border-white/50 [&_header]:bg-white/70 " +
            "[&_footer]:border-white/50 [&_footer]:bg-white/70"
          : "relative flex min-h-dvh flex-col bg-white"
      }
      style={
        {
          "--rc-accent": accent,
          "--rc-ink": `color-mix(in oklab, ${accent} 78%, black)`,
          "--rc-wash": `color-mix(in oklab, ${accent} 10%, white)`,
          "--rc-line": `color-mix(in oklab, ${accent} 40%, white)`,
        } as CSSProperties
      }
    >
      {shaderBackground && (
        <>
          {/* The accent's own wash, so the half-second before WebGL has drawn
              anything is the campaign's colour rather than a white flash. It
              is a layer rather than a background on the parent: as the
              parent's background it covered the canvas outright. Same z-index,
              earlier in the DOM — the canvas paints over it. */}
          <div className="pointer-events-none absolute inset-0 z-0 bg-[var(--rc-wash)]" aria-hidden />
          <ShaderBackground accent={accent} className="pointer-events-none absolute inset-0 z-0" />
        </>
      )}
      <StoreHeader storeUrl={storeUrl} />
      <main className="relative z-10 flex-1">
        {shaderBackground ? (
          // A sheet, not a panel: the shadow is what makes it read as paper
          // lifted off the colour instead of a white rectangle drawn on top,
          // and the white ring keeps its edge from going grey where the
          // gradient behind it is dark.
          <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-10">
            <div className="rounded-[2rem] bg-white shadow-[0_26px_70px_-24px_rgb(0_0_0/0.35)] ring-1 ring-white/70">
              {children}
            </div>
          </div>
        ) : (
          children
        )}
      </main>
      <div className="relative z-10">
        <StoreFooter />
      </div>
    </div>
  );
}

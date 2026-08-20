"use client";

import { Check, Gift } from "lucide-react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { getProductBySlug } from "@/data/products";
import { useLang } from "@/lib/lang-context";

export default function TieredRewardBox() {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const { lang, t } = useLang();

  const tieredEvals = evals.filter((e) => e.promo.kind === "tiered" && (e.promo.tiers ?? []).length > 0);
  if (!settings.tiered_box.enabled || tieredEvals.length === 0) return null;

  return (
    <div className="space-y-3">
      {tieredEvals.map((ev) => {
        const tiers = [...(ev.promo.tiers ?? [])].sort((a, b) => a.minSubtotal - b.minSubtotal);
        const unlockedCount = ev.unlockedTiers?.length ?? 0;
        const lastTier = tiers[tiers.length - 1];
        const percent = lastTier ? Math.min(100, (unlockedCount / tiers.length) * 100) : 0;
        return (
          <div key={ev.promo.slug} className="rounded-xl2 border border-slate-100 p-4 shadow-card">
            <h3 className="font-bold text-brand-ink text-sm flex items-center gap-1.5 mb-3">
              <Gift size={15} className="text-brand-emerald" /> {lang === "en" ? ev.promo.titleEn : ev.promo.titleTh}
            </h3>
            <div className="relative h-1.5 rounded-full bg-slate-100 mb-4">
              <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${percent}%` }} />
            </div>
            <div className="flex justify-between">
              {tiers.map((tier, i) => {
                const unlocked = i < unlockedCount;
                const gp = getProductBySlug(tier.giftProductSlug);
                return (
                  <div key={i} className="flex flex-col items-center gap-1 text-center flex-1">
                    <div
                      className={`grid h-8 w-8 place-items-center rounded-full ${unlocked ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-400"}`}
                    >
                      {unlocked ? <Check size={14} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                    </div>
                    <span className="text-[10px] text-slate-500">฿{tier.minSubtotal.toLocaleString()}</span>
                    <span className="text-[9px] text-slate-400 line-clamp-1 max-w-[60px]">{gp?.name ?? tier.giftProductSlug}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs mt-3 font-semibold text-center text-brand-emerald">
              {lang === "en" ? ev.reasonEn : ev.reasonTh}
            </p>
          </div>
        );
      })}
    </div>
  );
}

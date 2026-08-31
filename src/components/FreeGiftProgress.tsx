"use client";

import { Gift, Check, Lock } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";

function thresholdFor(promo: { kind: string; minSubtotal?: number; buyQty?: number; tiers?: { minSubtotal: number }[] }) {
  if (promo.kind === "spend") return promo.minSubtotal ?? 0;
  if (promo.kind === "tiered") return promo.tiers?.[0]?.minSubtotal ?? 0;
  return promo.buyQty ?? 0;
}

// The "Milestone bar" widget. Also reused, scoped to one product, as the
// small inline promo card on the product detail page (scopedToSlug).
export default function FreeGiftProgress({ scopedToSlug }: { scopedToSlug?: string } = {}) {
  const { lang, t } = useLang();
  const evals = useFreeGiftEvals(scopedToSlug);
  const { settings } = useWidgetSettings();

  if (!settings.milestone_bar.enabled || evals.length === 0) return null;

  const sorted = [...evals].sort((a, b) => thresholdFor(a.promo) - thresholdFor(b.promo));
  const connected = sorted.length > 1 && !scopedToSlug;

  return (
    <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
      <h2 className="font-bold text-brand-ink flex items-center gap-2 mb-3">
        <Gift size={17} className="text-brand-emerald" />
        {t("ของแถมฟรี", "Free gifts")}
      </h2>
      <div className={connected ? "flex items-start gap-1" : "flex flex-col gap-2.5"}>
        {sorted.map((ev, i) => {
          const title = lang === "en" ? ev.promo.titleEn : ev.promo.titleTh;
          const reason = lang === "en" ? ev.reasonEn : ev.reasonTh;
          if (connected) {
            return (
              <div key={ev.promo.slug} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      ev.eligible ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {ev.eligible ? <Check size={15} /> : <Lock size={13} />}
                  </div>
                  <span className="text-[10px] font-semibold text-brand-ink text-center line-clamp-2 max-w-[70px]">{title}</span>
                </div>
                {i < sorted.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded-sm ${ev.eligible ? "bg-brand-emerald" : "bg-slate-200"}`} />
                )}
              </div>
            );
          }
          return (
            <div
              key={ev.promo.slug}
              className={`w-full rounded-xl border p-3.5 ${ev.eligible ? "border-brand-teal bg-brand-gradient-soft" : "border-dashed border-slate-200"}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${ev.eligible ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-400"}`}
                >
                  {ev.eligible ? <Check size={14} /> : <Lock size={12} />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-brand-ink">{title}</span>
                  <p className={`text-xs mt-1 font-semibold ${ev.eligible ? "text-brand-emerald" : "text-amber-600"}`}>{reason}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

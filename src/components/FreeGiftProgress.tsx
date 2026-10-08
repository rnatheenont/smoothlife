"use client";

import { Gift, Check, Lock } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useCart } from "@/lib/cart-context";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import type { FreeGiftPromo } from "@/data/free-gifts";

function thresholdFor(promo: { kind: string; minSubtotal?: number; buyQty?: number; tiers?: { minSubtotal: number }[] }) {
  if (promo.kind === "spend") return promo.minSubtotal ?? 0;
  if (promo.kind === "tiered") return promo.tiers?.[0]?.minSubtotal ?? 0;
  return promo.buyQty ?? 0;
}

/** How far along this promo the cart has got, 0–100.
 *
 *  The widget is called the Milestone bar and had no bar in it: eligibility
 *  was a padlock or a tick, and how close you were lived in a sentence. A
 *  shopper deciding whether to add one more thing is asking a question about
 *  distance, and a sentence is a poor way to answer it. */
function percentFor(promo: FreeGiftPromo, subtotal: number, qtyOf: (slugs: string[]) => number): number {
  const pct = (have: number, need: number) => (need > 0 ? Math.min(100, (have / need) * 100) : 100);
  if (promo.kind === "spend") return pct(subtotal, promo.minSubtotal ?? 0);
  if (promo.kind === "tiered") {
    const tiers = [...(promo.tiers ?? [])].sort((a, b) => a.minSubtotal - b.minSubtotal);
    return pct(subtotal, tiers[tiers.length - 1]?.minSubtotal ?? 0);
  }
  // bxgy counts items, not money — and an empty buy list means any item
  // counts, which is how the "buy 3 of anything" promos are written.
  return pct(qtyOf(promo.buyProductSlugs ?? []), promo.buyQty ?? 0);
}

// The "Milestone bar" widget. Also reused, scoped to one product, as the
// small inline promo card on the product detail page (scopedToSlug).
export default function FreeGiftProgress({ scopedToSlug }: { scopedToSlug?: string } = {}) {
  const { lang, t } = useLang();
  const evals = useFreeGiftEvals(scopedToSlug);
  const { settings } = useWidgetSettings();
  const { lines } = useCart();

  // The same number the eligibility maths uses: a gift already in the cart
  // does not pay toward the next one.
  const paying = lines.filter((l) => !l.isGift);
  const subtotal = paying.reduce((sum, l) => sum + l.price * l.qty, 0);
  const qtyOf = (slugs: string[]) =>
    paying.filter((l) => slugs.length === 0 || slugs.includes(l.slug)).reduce((n, l) => n + l.qty, 0);

  if (!settings.milestone_bar.enabled || evals.length === 0) return null;

  const sorted = [...evals].sort((a, b) => thresholdFor(a.promo) - thresholdFor(b.promo));
  const connected = sorted.length > 1 && !scopedToSlug;

  return (
    <div className="rounded-xl2 p-5 shadow-card">
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
                      ev.eligible ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {ev.eligible ? <Check size={15} /> : <Lock size={13} />}
                  </div>
                  <span className="text-[10px] font-semibold text-brand-ink text-center line-clamp-2 max-w-[70px]">{title}</span>
                </div>
                {i < sorted.length - 1 && (
                  // The line between two milestones is the bar in this
                  // layout, so it fills with the distance to the next one
                  // instead of being on or off.
                  <div className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-brand-emerald transition-[width] duration-500 ease-out"
                      style={{
                        width: ev.eligible
                          ? `${percentFor(sorted[i + 1].promo, subtotal, qtyOf)}%`
                          : "0%",
                      }}
                    />
                  </div>
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
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${ev.eligible ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {ev.eligible ? <Check size={14} /> : <Lock size={12} />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-brand-ink">{title}</span>
                  <p className={`text-xs mt-1 font-semibold ${ev.eligible ? "text-brand-800" : "text-amber-700"}`}>{reason}</p>
                  {!ev.eligible && (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 ease-out"
                        style={{ width: `${percentFor(ev.promo, subtotal, qtyOf)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

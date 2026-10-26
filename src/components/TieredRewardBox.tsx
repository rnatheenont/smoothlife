"use client";

import Image from "next/image";
import { Check, Gift, Lock } from "lucide-react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useCart } from "@/lib/cart-context";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useLang } from "@/lib/lang-context";
import { formatTHB } from "@/lib/format";
import { leadGiftFace } from "@/lib/gift-faces";

/** Where the fill should stop, as a fraction of the track.
 *
 *  The markers are laid out with justify-between over equal flex children,
 *  so marker i sits at the CENTRE of segment i — (i + 0.5) / n along the
 *  track, not i / n. A bar that ignored that would run past its own ticks.
 *
 *  Between two markers the fill moves with the money: it is the whole point
 *  of the bar, and it is what the old one did not do. That one was
 *  unlockedCount / tiers.length, so with three tiers it could only ever be
 *  0, 33, 67 or 100 — ฿0 and ฿999 of a ฿1,000 tier drew exactly the same
 *  bar, which is the one question a shopper is asking it. */
function ladderPercent(tiers: { minSubtotal: number }[], subtotal: number): number {
  const n = tiers.length;
  if (n === 0) return 0;
  const unlocked = tiers.filter((t) => subtotal >= t.minSubtotal).length;
  if (unlocked >= n) return 100;
  const slot = 1 / n;
  if (unlocked === 0) {
    const first = tiers[0].minSubtotal;
    const frac = first > 0 ? Math.min(1, subtotal / first) : 1;
    return frac * slot * 50; // 0 → the first marker at 0.5/n
  }
  const from = tiers[unlocked - 1].minSubtotal;
  const to = tiers[unlocked].minSubtotal;
  const span = to - from;
  const frac = span > 0 ? Math.min(1, Math.max(0, (subtotal - from) / span)) : 1;
  return ((unlocked - 0.5) * slot + frac * slot) * 100;
}

export default function TieredRewardBox() {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const { lines, productBySlug } = useCart();
  const { lang, t } = useLang();

  // The same number the eligibility maths uses: gifts already in the cart
  // do not pay toward the next gift.
  const subtotal = lines.filter((l) => !l.isGift).reduce((sum, l) => sum + l.price * l.qty, 0);

  const tieredEvals = evals.filter((e) => e.promo.kind === "tiered" && (e.promo.tiers ?? []).length > 0);
  if (!settings.tiered_box.enabled || tieredEvals.length === 0) return null;

  return (
    <div className="space-y-3">
      {tieredEvals.map((ev) => {
        const tiers = [...(ev.promo.tiers ?? [])].sort((a, b) => a.minSubtotal - b.minSubtotal);
        const unlockedCount = ev.unlockedTiers?.length ?? 0;
        const percent = ladderPercent(tiers, subtotal);
        const nextTier = tiers[unlockedCount];
        return (
          <div key={ev.promo.slug} className="rounded-xl2 p-4 shadow-card">
            <h3 className="font-bold text-brand-ink text-sm flex items-center gap-1.5 mb-3">
              <Gift size={15} className="text-brand-emerald" /> {lang === "en" ? ev.promo.titleEn : ev.promo.titleTh}
            </h3>
            <div className="relative mb-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex justify-between gap-2">
              {tiers.map((tier, i) => {
                const unlocked = i < unlockedCount;
                // The reward, photographed. This read tier.giftProductSlug
                // and printed it raw when the catalogue had never heard of
                // it — which, for every tiered promo currently running, meant
                // printing an empty string under each rung of the ladder.
                const face = leadGiftFace(tier, productBySlug);
                return (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
                    <span className="relative">
                      {face?.image ? (
                        <Image
                          src={face.image}
                          alt=""
                          width={96}
                          height={96}
                          className={`size-12 rounded-xl2 bg-white object-contain ring-1 transition ${
                            unlocked ? "ring-brand-200" : "opacity-55 grayscale ring-surface-line"
                          }`}
                        />
                      ) : (
                        <span
                          className={`grid size-12 place-items-center rounded-xl2 ring-1 ${
                            unlocked ? "bg-brand-50 text-brand-emerald ring-brand-200" : "bg-slate-50 text-slate-400 ring-surface-line"
                          }`}
                        >
                          <Gift size={18} aria-hidden />
                        </span>
                      )}
                      <span
                        className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full text-white ${
                          unlocked ? "bg-brand-gradient" : "bg-slate-300"
                        }`}
                      >
                        {unlocked ? <Check size={11} /> : <Lock size={9} />}
                      </span>
                    </span>
                    <span className={`text-[11px] font-bold ${unlocked ? "text-brand-800" : "text-slate-500"}`}>
                      ฿{tier.minSubtotal.toLocaleString()}
                    </span>
                    <span className="line-clamp-2 px-0.5 text-[11px] leading-tight text-slate-500">
                      {face?.title ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-brand-800">
              {lang === "en" ? ev.reasonEn : ev.reasonTh}
            </p>
            {nextTier && (
              <p className="mt-1 text-center text-[11px] text-slate-500">
                {lang === "en"
                  ? `${formatTHB(subtotal)} of ${formatTHB(nextTier.minSubtotal)}`
                  : `ตอนนี้ ${formatTHB(subtotal)} จาก ${formatTHB(nextTier.minSubtotal)}`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

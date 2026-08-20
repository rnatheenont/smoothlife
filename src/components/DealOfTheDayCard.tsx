"use client";

import { useState } from "react";
import { X, Flame } from "lucide-react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useCountdown } from "@/lib/use-countdown";
import { useLang } from "@/lib/lang-context";

// A promo's real `expires` date drives the countdown when set; otherwise
// falls back to a rolling window anchored to when this card first mounted
// (config.endsInHours), so there's still a real ticking countdown even for
// promos with no explicit expiry.
export default function DealOfTheDayCard() {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const { lang, t } = useLang();
  const [dismissed, setDismissed] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  const claimable = evals.filter((e) => e.eligible || e.promo.kind !== "tiered");
  const withExpiry = claimable.find((e) => e.promo.expires);
  const endsInHours = Number(settings.deal_of_day.config.endsInHours ?? 24);
  const fallbackTarget = new Date(mountedAt + endsInHours * 3600 * 1000).toISOString();
  const target = withExpiry?.promo.expires ?? (claimable.length > 0 ? fallbackTarget : null);
  const countdown = useCountdown(target);

  if (!settings.deal_of_day.enabled || dismissed || claimable.length === 0 || countdown.expired) return null;

  const headline = (settings.deal_of_day.config.headlineTh as string) || "ดีลวันนี้ รับของแถมได้เลย";
  const cta = (settings.deal_of_day.config.ctaTh as string) || "รับเลย";
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="rounded-xl2 border border-amber-200 bg-amber-50 p-4 relative">
      <button onClick={() => setDismissed(true)} className="absolute right-3 top-3 text-slate-400" aria-label="ปิด">
        <X size={15} />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <Flame size={16} className="text-amber-500" />
        <h3 className="font-bold text-brand-ink text-sm">{headline}</h3>
      </div>
      <div className="flex items-center gap-1 mb-3">
        {[countdown.hours, countdown.minutes, countdown.seconds].map((v, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="rounded-md bg-brand-ink text-white text-xs font-bold px-2 py-1 tabular-nums">{pad(v)}</span>
            {i < 2 && <span className="text-amber-500 font-bold">:</span>}
          </span>
        ))}
      </div>
      <div className="space-y-1.5 mb-3">
        {claimable.slice(0, 3).map((ev) => (
          <p key={ev.promo.slug} className="text-xs text-brand-ink">
            🎁 {lang === "en" ? ev.promo.titleEn : ev.promo.titleTh}
          </p>
        ))}
      </div>
      <button className="w-full rounded-full bg-brand-gradient text-white text-xs font-semibold py-2">
        {t(cta, cta)}
      </button>
    </div>
  );
}

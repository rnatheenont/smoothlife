"use client";

import { useState } from "react";
import { X, Flame } from "lucide-react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useCountdown } from "@/lib/use-countdown";
import { useLang } from "@/lib/lang-context";
import { Button } from "@/components/ui";

// A promo's real `expires` date drives the countdown when set; otherwise
// falls back to a rolling window anchored to when this card first mounted
// (endsInHours), so there's still a real ticking countdown even for promos
// with no explicit expiry.
//
// Two ways in. Given `config`, the words and the window come from the page
// section that drew it, and being on the page is what "on" means. Given
// nothing, it reads the widget row as it always did — which is the
// hard-coded home page, still live until PAGES_HOME_ENABLED is switched on.
export type DealOfDayConfig = { headlineTh: string; ctaTh: string; endsInHours: number };

export default function DealOfTheDayCard({ config }: { config?: DealOfDayConfig }) {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const { lang, t } = useLang();
  const [dismissed, setDismissed] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  const claimable = evals.filter((e) => e.eligible || e.promo.kind !== "tiered");
  const withExpiry = claimable.find((e) => e.promo.expires);
  const widget = settings.deal_of_day;
  const endsInHours = Number(config?.endsInHours ?? widget.config.endsInHours ?? 24);
  const fallbackTarget = new Date(mountedAt + endsInHours * 3600 * 1000).toISOString();
  const target = withExpiry?.promo.expires ?? (claimable.length > 0 ? fallbackTarget : null);
  const countdown = useCountdown(target);

  // No widget gate when the page supplied the settings: the section being on
  // the page, and not hidden, is the answer to "should this be here".
  if (!config && !widget.enabled) return null;
  if (dismissed || claimable.length === 0 || countdown.expired) return null;

  const headline = config?.headlineTh || (widget.config.headlineTh as string) || "ดีลวันนี้ รับของแถมได้เลย";
  const cta = config?.ctaTh || (widget.config.ctaTh as string) || "รับเลย";
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="rounded-xl2 border border-amber-200 bg-amber-50 p-4 relative my-6 md:my-8">
      <button onClick={() => setDismissed(true)} className="absolute right-3 top-3 text-slate-500" aria-label="ปิด">
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
            {i < 2 && <span className="text-amber-700 font-bold">:</span>}
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
      <Button size="sm" fullWidth>
        {t(cta, cta)}
      </Button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { X, PartyPopper } from "lucide-react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useGiftEligibilityTransitions } from "@/lib/use-gift-eligibility-transitions";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useLang } from "@/lib/lang-context";

export default function GiftUnlockPopup() {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const newlyEligible = useGiftEligibilityTransitions(evals);
  const { lang } = useLang();
  const [visible, setVisible] = useState<typeof newlyEligible>([]);

  useEffect(() => {
    if (!settings.popup.enabled) return;
    if (newlyEligible.length > 0) setVisible(newlyEligible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyEligible, settings.popup.enabled]);

  useEffect(() => {
    if (visible.length === 0) return;
    const autoCloseMs = Number(settings.popup.config.autoCloseMs ?? 0);
    if (!autoCloseMs) return;
    const id = setTimeout(() => setVisible([]), autoCloseMs);
    return () => clearTimeout(id);
  }, [visible, settings.popup.config]);

  useEffect(() => {
    if (visible.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!settings.popup.enabled || visible.length === 0) return null;

  const headline = (settings.popup.config.headlineTh as string) || "ยินดีด้วย! ปลดล็อกของแถมแล้ว";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setVisible([])} />
      <div className="relative w-full max-w-sm rounded-xl2 bg-white p-6 text-center shadow-cardHover animate-fadeUp">
        <button onClick={() => setVisible([])} className="absolute right-3 top-3" aria-label="ปิด">
          <X size={18} className="text-slate-400" />
        </button>
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand-gradient-soft">
          <PartyPopper size={26} className="text-brand-emerald" />
        </div>
        <h3 className="font-bold text-brand-ink text-lg">{headline}</h3>
        <div className="mt-3 space-y-1.5">
          {visible.map((ev) => (
            <p key={ev.promo.slug} className="text-sm text-brand-emerald font-semibold">
              🎁 {lang === "en" ? ev.promo.titleEn : ev.promo.titleTh}
            </p>
          ))}
        </div>
        <button
          onClick={() => setVisible([])}
          className="mt-5 w-full rounded-full bg-brand-gradient text-white font-semibold py-2.5 text-sm"
        >
          รับเลย
        </button>
      </div>
    </div>
  );
}

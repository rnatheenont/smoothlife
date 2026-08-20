"use client";

import { useEffect, useState } from "react";
import { X, PartyPopper } from "lucide-react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useGiftEligibilityTransitions } from "@/lib/use-gift-eligibility-transitions";
import { useWidgetSettings } from "@/lib/use-widget-settings";

export default function GiftCongratsBar() {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const newlyEligible = useGiftEligibilityTransitions(evals);
  const [visible, setVisible] = useState(false);

  // Precedence: if the Pop-up widget is also on, it "claims" the transition
  // event instead — showing both would double-interrupt the shopper.
  const active = settings.congrats_bar.enabled && !settings.popup.enabled;

  useEffect(() => {
    if (!active) return;
    if (newlyEligible.length > 0) setVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyEligible, active]);

  useEffect(() => {
    if (!visible) return;
    const durationMs = Number(settings.congrats_bar.config.durationMs ?? 4000);
    const id = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(id);
  }, [visible, settings.congrats_bar.config]);

  if (!active || !visible) return null;

  const message = (settings.congrats_bar.config.messageTh as string) || "ปลดล็อกของแถมแล้ว!";

  return (
    <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[110] w-[calc(100%-2rem)] max-w-sm animate-fadeUp">
      <div className="flex items-center gap-2 rounded-full bg-brand-gradient text-white shadow-cardHover px-4 py-2.5">
        <PartyPopper size={16} className="shrink-0" />
        <span className="text-xs font-semibold flex-1">{message}</span>
        <button onClick={() => setVisible(false)} aria-label="ปิด">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

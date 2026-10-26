"use client";

import { useEffect, useState } from "react";
import { X, PartyPopper } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useGiftEligibilityTransitions } from "@/lib/use-gift-eligibility-transitions";
import { useWidgetSettings } from "@/lib/use-widget-settings";

export default function GiftCongratsBar() {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const newlyEligible = useGiftEligibilityTransitions(evals);
  const [visible, setVisible] = useState(false);
  const still = useReducedMotion();

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

  if (!active) return null;

  const message = (settings.congrats_bar.config.messageTh as string) || "ปลดล็อกของแถมแล้ว!";

  // It drops in and lifts back out. The old one appeared with a fade and then
  // vanished mid-sentence when its timer ran down, which reads as a glitch
  // rather than as something finishing.
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={still ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={still ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          role="status"
          className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-110 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
        >
          <div className="flex items-center gap-2.5 rounded-full bg-brand-gradient py-2 pl-2 pr-3 text-white shadow-cardHover">
            <motion.span
              initial={still ? false : { scale: 0.4, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 14, delay: 0.08 }}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur-sm"
            >
              <PartyPopper size={16} aria-hidden />
            </motion.span>
            <span className="flex-1 text-xs font-semibold leading-snug">{message}</span>
            <button
              onClick={() => setVisible(false)}
              aria-label="ปิด"
              className="grid size-6 shrink-0 place-items-center rounded-full transition hover:bg-white/20"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

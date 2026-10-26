"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Gift } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Modal } from "@/components/ui";
import { giftsOf, type FreeGiftEval, type FreeGiftItem } from "@/data/free-gifts";
import { giftLabel } from "@/lib/gift-faces";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useGiftEligibilityTransitions } from "@/lib/use-gift-eligibility-transitions";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useLang } from "@/lib/lang-context";

// The moment a basket earns something, said as the thing it earned.
//
// It used to list the names of the promotions that had just fired — "ของแถม
// ทุกคำสั่งซื้อ", "ซื้อครบรับของแถม 25–31 ต.ค." — which are the names of the
// rules, not of the presents. A shopper reading that has been congratulated
// and still does not know what they got.
//
// So the gifts themselves are the content: a photograph and a name each, the
// way Hims and Klook present an unlocked reward. One button, because there is
// only one thing to do next.
//
// It also borrows the shared dialog rather than drawing its own overlay, so
// Escape, the backdrop, the focus trap and the locked page behind it all work
// the way they do everywhere else in this app.

/** What this promo just handed over — the unlocked tiers' gifts for a ladder,
 *  the promo's own for everything else. */
function wonFrom(ev: FreeGiftEval): FreeGiftItem[] {
  if (ev.unlockedTiers?.length) return ev.unlockedTiers.flatMap((t) => giftsOf(t));
  return giftsOf(ev.promo);
}

export default function GiftUnlockPopup() {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const newlyEligible = useGiftEligibilityTransitions(evals);
  const { lang, t } = useLang();
  const still = useReducedMotion();
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

  if (!settings.popup.enabled || visible.length === 0) return null;

  const headline =
    (settings.popup.config.headlineTh as string) || t("ปลดล็อกของแถมแล้ว", "You unlocked a gift");

  // One flat list. Which rule produced which present is bookkeeping, and the
  // shopper is being shown a pile of presents.
  const won = visible.flatMap((ev) =>
    wonFrom(ev).map((g) => ({
      key: `${ev.promo.slug}-${g.variantId ?? g.productSlug}`,
      name: giftLabel(g.title) ?? (lang === "en" ? ev.promo.titleEn : ev.promo.titleTh),
      image: g.image,
      qty: g.qty,
    })),
  );

  const close = () => setVisible([]);
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <Modal
      open
      onClose={close}
      title={headline}
      description={t(
        `ของแถม ${won.length} ชิ้นถูกใส่ในตะกร้าให้แล้ว`,
        `${won.length} ${won.length === 1 ? "gift has" : "gifts have"} been added to your cart`,
      )}
      size="sm"
      footer={
        <Link
          href="/cart"
          onClick={close}
          className="w-full rounded-full bg-brand-gradient py-2.5 text-center text-sm font-semibold text-white"
        >
          {t("ดูตะกร้า", "View cart")}
        </Link>
      }
    >
      <div className="flex flex-col items-center">
        {/* The badge lands first and the presents follow it, so the eye is
            already where the list begins. */}
        <motion.span
          initial={still ? false : { scale: 0.5, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="grid size-14 place-items-center rounded-full bg-brand-gradient-soft"
        >
          <Gift size={26} className="text-brand-emerald" aria-hidden />
        </motion.span>

        <ul className="mt-4 w-full space-y-2">
          {won.map((g, i) => (
            <motion.li
              key={g.key}
              initial={still ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.07, duration: 0.45, ease }}
              className="flex items-center gap-3 rounded-xl bg-surface-soft p-2.5"
            >
              {g.image ? (
                <Image
                  src={g.image}
                  alt=""
                  width={96}
                  height={96}
                  className="size-11 shrink-0 rounded-lg bg-white object-contain ring-1 ring-slate-100"
                />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-brand-emerald ring-1 ring-slate-100">
                  <Gift size={18} aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1 text-left text-[13px] font-semibold leading-snug text-brand-ink">
                {g.name}
                {g.qty > 1 && <span className="font-normal text-slate-500"> × {g.qty}</span>}
              </span>
              <span className="shrink-0 rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-bold text-white">
                {t("ฟรี", "Free")}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

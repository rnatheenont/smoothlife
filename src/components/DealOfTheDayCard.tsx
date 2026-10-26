"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Gift } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useCountdown, type CountdownParts } from "@/lib/use-countdown";
import { useCart } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";
import { availableGiftFaces, type GiftFace } from "@/lib/gift-faces";
import { BorderBeam } from "@/components/magicui/border-beam";

// The deal, said as the things it gives you.
//
// It used to be a flat amber box listing the names of the rules — "ของแถมทุก
// คำสั่งซื้อ" — above three unlabelled digit boxes reading 130 : 08 : 44, and
// a button that went nowhere. Three separate ways of telling a shopper almost
// nothing: the rule's name is not the present, 130 of anything is not a
// deadline anyone can feel, and a call to action that does not act is decor.
//
// Now it shows the gifts themselves, photographed, the way Selfridges and
// lululemon show perks (mobbin.com/screens/019e4562-280c-4048-ad39-6f937891a8f2,
// mobbin.com/screens/5eaeb751-d5db-48b1-9452-bd3bdcd4b881); the clock is
// segmented and labelled, the pattern every countdown on 21st.dev settles on
// (21st.dev/s/countdown); and the button goes to the cart.
//
// Two ways in. Given `config`, the words and the window come from the page
// section that drew it, and being on the page is what "on" means. Given
// nothing, it reads the widget row as it always did.
export type DealOfDayConfig = { headlineTh: string; ctaTh: string; endsInHours: number };

/** The clock, as units a person can feel. Days only appear once there is at
 *  least one; seconds drop off past a day, where they are just noise. */
function segmentsFor(c: CountdownParts, en: boolean) {
  const all = [
    { value: c.days, label: en ? "days" : "วัน" },
    { value: c.hours, label: en ? "hrs" : "ชม." },
    { value: c.minutes, label: en ? "min" : "นาที" },
    { value: c.seconds, label: en ? "sec" : "วิ" },
  ];
  return c.days > 0 ? all.slice(0, 3) : all.slice(1);
}

export default function DealOfTheDayCard({ config }: { config?: DealOfDayConfig }) {
  const { settings } = useWidgetSettings();
  const evals = useFreeGiftEvals();
  const { productBySlug } = useCart();
  const { lang, t } = useLang();
  const still = useReducedMotion();
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
  const en = lang === "en";

  // The presents, pooled across every promo on offer and deduplicated — two
  // campaigns handing over the same thing is one thing to the shopper.
  const seen = new Set<string>();
  const faces: GiftFace[] = [];
  for (const ev of claimable) {
    const source = ev.promo.kind === "tiered" ? (ev.promo.tiers?.[0] ?? ev.promo) : ev.promo;
    for (const face of availableGiftFaces(source, productBySlug)) {
      if (!face.title || seen.has(face.key)) continue;
      seen.add(face.key);
      faces.push(face);
    }
  }
  const shown = faces.slice(0, 4);
  const more = faces.length - shown.length;
  const segments = segmentsFor(countdown, en);
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <motion.section
      initial={still ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      aria-label={headline}
      className="relative my-6 overflow-hidden rounded-feature bg-brand-gradient-soft shadow-card md:my-8"
    >
      {!still && <BorderBeam size={120} duration={9} colorFrom="#00b39b" colorTo="#00aeef" />}

      <button
        onClick={() => setDismissed(true)}
        aria-label={t("ปิด", "Dismiss")}
        className="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-full bg-white/70 text-slate-500 backdrop-blur-sm transition hover:bg-white hover:text-brand-ink"
      >
        <X size={14} />
      </button>

      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-6">
        {/* Left: what it is and when it ends. */}
        <div className="min-w-0 md:flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-200">
            <Gift size={12} aria-hidden />
            {t("ของแถมฟรี", "Free gift")}
          </span>
          <h3 className="mt-2 text-balance text-base font-bold leading-snug text-brand-ink md:text-lg">{headline}</h3>

          <div className="mt-3 flex items-end gap-1.5">
            {segments.map((seg, i) => (
              <span key={seg.label} className="flex items-end gap-1.5">
                <span className="flex flex-col items-center gap-1">
                  <span className="grid min-w-[2.75rem] place-items-center rounded-xl2 bg-brand-ink px-2 py-1.5 text-lg font-bold tabular-nums text-white shadow-card md:text-xl">
                    {String(seg.value).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-800">{seg.label}</span>
                </span>
                {i < segments.length - 1 && (
                  <span aria-hidden className="pb-6 text-lg font-bold text-brand-400">
                    :
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Right: the presents, then the way to them. With no presents to
            show — Shopify unreachable, or every gift sold out — the column
            shrinks to the button rather than stretching one across half the
            card. */}
        <div className={`flex flex-col gap-3 md:shrink-0 ${shown.length > 0 ? "md:w-[46%]" : ""}`}>
          <ul className="flex flex-wrap gap-2">
            {shown.map((face, i) => (
              <motion.li
                key={face.key}
                initial={still ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease }}
                className="flex min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center gap-2 rounded-xl2 bg-white/80 p-1.5 ring-1 ring-white/90 backdrop-blur-sm"
              >
                {face.image ? (
                  <Image
                    src={face.image}
                    alt=""
                    width={88}
                    height={88}
                    className="size-10 shrink-0 rounded-m bg-white object-contain"
                  />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-m bg-brand-50 text-brand-emerald">
                    <Gift size={16} aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1 text-[11px] font-semibold leading-tight text-brand-ink line-clamp-2">
                  {face.title}
                </span>
              </motion.li>
            ))}
          </ul>
          {more > 0 && (
            <p className="text-[11px] font-semibold text-brand-800">
              {en ? `and ${more} more` : `และอีก ${more} ชิ้น`}
            </p>
          )}
          <Link
            href="/cart"
            className={`grid h-11 place-items-center rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-card transition hover:brightness-105 active:scale-[0.99] ${
              shown.length > 0 ? "" : "md:px-10"
            }`}
          >
            {t(cta, cta)}
          </Link>
        </div>
      </div>
    </motion.section>
  );
}

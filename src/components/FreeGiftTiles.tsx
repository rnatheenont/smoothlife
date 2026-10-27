"use client";

import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useLang } from "@/lib/lang-context";
import { availableGiftFaces, type GiftFace } from "@/lib/gift-faces";
import { giftWidgetStyle } from "@/lib/gift-widget-style";
import type { FreeGiftPromo } from "@/data/free-gifts";
import { Check, Gift } from "lucide-react";

// The gift, as a thing you get.
//
// The product page used to carry the whole milestone card for this: a titled
// panel, a promo name, a sentence restating the promo name, and then the gift
// in small type at the bottom. Four lines of chrome around one fact — that
// buying this gets you a mint tab, with a photograph of it. The panel is still
// the right shape in the cart, where several promos at different distances
// have to be compared; here there is one thing to say.

/** The gifts this product can earn, grouped by the campaign offering them.
 *
 *  Grouped rather than pooled, because each campaign now carries its own
 *  look: a flat list has nothing to hang a style on. Deduplication is still
 *  across the whole page — the same gift from two campaigns is one gift to
 *  the shopper, and it is shown under the first that offers it. */
function faceGroups(
  evals: { promo: FreeGiftPromo; eligible: boolean }[],
  productBySlug: (slug: string) => { name: string; image: string } | undefined,
): { promo: FreeGiftPromo; faces: GiftFace[]; earned: boolean }[] {
  const seen = new Set<string>();
  const groups: { promo: FreeGiftPromo; faces: GiftFace[]; earned: boolean }[] = [];
  for (const ev of evals) {
    // A ladder is shown by its first rung: the one this product can reach
    // without knowing what else is in the basket.
    const promo = ev.promo;
    const source = (promo.kind === "tiered" ? (promo.tiers?.[0] ?? promo) : promo) as Parameters<
      typeof availableGiftFaces
    >[0];
    const faces: GiftFace[] = [];
    for (const face of availableGiftFaces(source, productBySlug)) {
      if (!face.title || seen.has(face.key)) continue;
      seen.add(face.key);
      faces.push(face);
    }
    if (faces.length > 0) groups.push({ promo, faces, earned: ev.eligible });
  }
  return groups;
}

export default function FreeGiftTiles({ scopedToSlug }: { scopedToSlug?: string } = {}) {
  const evals = useFreeGiftEvals(scopedToSlug);
  const { productBySlug } = useCart();
  const { settings } = useWidgetSettings();
  const { t } = useLang();

  if (!settings.milestone_bar.enabled) return null;
  const groups = faceGroups(evals, productBySlug);
  if (groups.length === 0) return null;

  // The shop-wide default, for campaigns nobody has restyled. An untouched
  // widget gives back the numbers this was drawn with before the editor
  // existed, so nothing moves until somebody moves it.
  const shopDefault = settings.milestone_bar.config;

  return (
    <>
      {groups.map(({ promo, faces, earned }) => {
        // The campaign's own look if it has one, the shop's otherwise.
        const style = giftWidgetStyle(promo.widgetStyle ?? shopDefault);

        // The bar layout, drawn the way 21st.dev's Progress Bar Stepper does
        // it: one segment per reward with its name underneath. The setting
        // existed in the editor before this and changed nothing out here,
        // which is a control that lies to whoever moves it.
        if (style.layout === "bar") {
          return (
            <div key={promo.slug} className="flex [&+&]:mt-3" style={{ gap: style.gap }}>
              {faces.map((face) => (
                <span key={face.key} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span
                    style={{ height: style.barThickness, borderRadius: style.barRadius }}
                    className="overflow-hidden bg-black/10"
                  >
                    <span
                      style={{
                        display: "block",
                        width: earned ? "100%" : "0%",
                        height: "100%",
                        borderRadius: style.barRadius,
                        background: `linear-gradient(90deg, ${style.accentFrom}, ${style.accentTo})`,
                      }}
                      className="transition-[width] duration-500"
                    />
                  </span>
                  <span className="flex items-start gap-1">
                    <span style={{ color: earned ? style.accentFrom : undefined }} className={earned ? "" : "opacity-40"}>
                      {earned ? <Check size={11} aria-hidden /> : <Gift size={11} aria-hidden />}
                    </span>
                    <span
                      style={{ fontSize: style.tierSize, color: style.text }}
                      className={`line-clamp-2 min-w-0 flex-1 font-semibold leading-tight ${earned ? "" : "opacity-60"}`}
                    >
                      {face.title}
                    </span>
                  </span>
                </span>
              ))}
            </div>
          );
        }

        return (
          <ul
            key={promo.slug}
            className="grid grid-cols-2 sm:grid-cols-3 [&+&]:mt-2"
            style={{ gap: style.gap }}
          >
            {faces.map((face) => (
        <li
          key={face.key}
          style={{ borderRadius: style.radius }}
          className="flex items-center gap-2 bg-brand-gradient-soft p-2 ring-1 ring-brand-100"
        >
          <span
            style={{ width: style.iconSize, height: style.iconSize, borderRadius: style.radius }}
            className="relative shrink-0 overflow-hidden bg-white"
          >
            {face.image && <Image src={face.image} alt="" fill sizes="64px" className="object-contain" />}
          </span>
          <span
            style={{ fontSize: style.tierSize, color: style.text }}
            className="min-w-0 flex-1 font-semibold leading-tight"
          >
            <span className="line-clamp-2">{face.title}</span>
            <span
              style={{ color: style.accentFrom }}
              className="mt-0.5 block font-bold"
            >
              {t("ฟรี", "Free")}
              {face.qty > 1 && <span className="font-normal text-slate-500"> × {face.qty}</span>}
            </span>
          </span>
              </li>
            ))}
          </ul>
        );
      })}
    </>
  );
}

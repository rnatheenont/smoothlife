"use client";

import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useLang } from "@/lib/lang-context";
import { availableGiftFaces, type GiftFace } from "@/lib/gift-faces";

// The gift, as a thing you get.
//
// The product page used to carry the whole milestone card for this: a titled
// panel, a promo name, a sentence restating the promo name, and then the gift
// in small type at the bottom. Four lines of chrome around one fact — that
// buying this gets you a mint tab, with a photograph of it. The panel is still
// the right shape in the cart, where several promos at different distances
// have to be compared; here there is one thing to say.

/** The gifts this product can earn, deduplicated across promos. */
function facesFor(
  evals: { promo: { kind: string; tiers?: unknown[] }; unlockedTiers?: { tierIndex: number }[] }[],
  productBySlug: (slug: string) => { name: string; image: string } | undefined,
): GiftFace[] {
  const seen = new Set<string>();
  const out: GiftFace[] = [];
  for (const ev of evals) {
    // A ladder is shown by its first rung: the one this product can reach
    // without knowing what else is in the basket.
    const promo = ev.promo as { kind: string; tiers?: unknown[] };
    const source = (promo.kind === "tiered" ? (promo.tiers?.[0] ?? promo) : promo) as Parameters<
      typeof availableGiftFaces
    >[0];
    for (const face of availableGiftFaces(source, productBySlug)) {
      if (!face.title || seen.has(face.key)) continue;
      seen.add(face.key);
      out.push(face);
    }
  }
  return out;
}

export default function FreeGiftTiles({ scopedToSlug }: { scopedToSlug?: string } = {}) {
  const evals = useFreeGiftEvals(scopedToSlug);
  const { productBySlug } = useCart();
  const { settings } = useWidgetSettings();
  const { t } = useLang();

  if (!settings.milestone_bar.enabled) return null;
  const faces = facesFor(evals, productBySlug);
  if (faces.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {faces.map((face) => (
        <li
          key={face.key}
          className="flex items-center gap-2 rounded-xl2 bg-brand-gradient-soft p-2 ring-1 ring-brand-100"
        >
          <span className="relative size-11 shrink-0 overflow-hidden rounded-m bg-white">
            {face.image && <Image src={face.image} alt="" fill sizes="44px" className="object-contain" />}
          </span>
          <span className="min-w-0 flex-1 text-[11px] font-semibold leading-tight text-brand-ink">
            <span className="line-clamp-2">{face.title}</span>
            <span className="brand-text-gradient mt-0.5 block font-bold">
              {t("ฟรี", "Free")}
              {face.qty > 1 && <span className="font-normal text-slate-500"> × {face.qty}</span>}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

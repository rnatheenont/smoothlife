"use client";

import Image from "next/image";
import Link from "next/link";
import { Gift, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useLang } from "@/lib/lang-context";
import { leadGiftFace } from "@/lib/gift-faces";
import { formatTHB } from "@/lib/format";
import type { FreeGiftPromo } from "@/data/free-gifts";

const KIND_BADGE: Record<string, { th: string; en: string }> = {
  spend: { th: "ซื้อครบฟรี", en: "Spend & get free" },
  bxgy: { th: "ซื้อ 1 แถม 1", en: "Buy & get free" },
  tiered: { th: "ยิ่งซื้อยิ่งได้", en: "Tiered rewards" },
};

export type PromoCardConfig = { maxCards: number };

/** The condition, in the shopper's words rather than the schema's. A card
 *  that says what the promo is called but not what it asks for leaves the one
 *  question unanswered. */
function conditionOf(promo: FreeGiftPromo, en: boolean): string | undefined {
  if (promo.kind === "spend" && promo.minSubtotal && promo.minSubtotal > 1) {
    return en ? `Spend ${formatTHB(promo.minSubtotal)}` : `ซื้อครบ ${formatTHB(promo.minSubtotal)}`;
  }
  if (promo.kind === "tiered") {
    const tiers = [...(promo.tiers ?? [])].sort((a, b) => a.minSubtotal - b.minSubtotal);
    const first = tiers[0]?.minSubtotal;
    if (first) return en ? `From ${formatTHB(first)}` : `เริ่มที่ ${formatTHB(first)}`;
  }
  if (promo.kind === "bxgy" && promo.buyQty) {
    return en ? `Buy ${promo.buyQty}` : `ซื้อ ${promo.buyQty} ชิ้น`;
  }
  // A promo with no threshold worth naming — "every order" — says so.
  return en ? "Every order" : "ทุกคำสั่งซื้อ";
}

export default function FreeGiftPromoCard({ config }: { config?: PromoCardConfig }) {
  const { giftPromos, productBySlug } = useCart();
  const { settings } = useWidgetSettings();
  const { lang } = useLang();
  const widget = settings.promotion_card;

  // Given settings by the page, the section's presence is what switches it
  // on; otherwise the widget row decides, as it always did.
  if (!config && !widget.enabled) return null;
  const active = giftPromos.filter((p) => p.active);
  if (active.length === 0) return null;
  const maxCards = Number(config?.maxCards ?? widget.config.maxCards ?? 4);
  const cards = active.slice(0, maxCards);
  const en = lang === "en";

  return (
    <div className="my-6 grid grid-cols-2 gap-3 md:my-8 md:grid-cols-4 md:gap-4">
      {cards.map((promo) => {
        // The gift's own photograph, wherever it is written down. This used
        // to read giftProductSlug and nothing else — the field every promo
        // currently running leaves empty — so the cards were grey rectangles
        // with a caption, which is what prompted this rewrite.
        const source = promo.kind === "tiered" ? (promo.tiers?.[0] ?? promo) : promo;
        const face = leadGiftFace(source, productBySlug);
        const badge = KIND_BADGE[promo.kind] ?? KIND_BADGE.spend;
        const title = en ? promo.titleEn : promo.titleTh;
        return (
          <Link
            key={promo.slug}
            href="/cart"
            aria-label={title}
            className="group relative flex aspect-4/3 flex-col justify-end overflow-hidden rounded-xl2 bg-brand-dark shadow-card transition-shadow hover:shadow-cardHover"
          >
            {face?.image ? (
              <Image
                src={face.image}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              // Not a grey void. A promo whose gift has no photograph still
              // has a brand and a shape, and the card has to stand next to
              // ones that do without looking broken.
              <span aria-hidden className="absolute inset-0 grid place-items-center bg-brand-gradient">
                <Gift size={40} className="text-white/35" />
              </span>
            )}

            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/80 via-black/40 to-transparent"
            />

            <div className="relative p-3 text-white md:p-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm">
                <Gift size={10} aria-hidden />
                {en ? badge.en : badge.th}
              </span>
              <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug md:text-base">{title}</h3>
              <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-white/85">
                {conditionOf(promo, en)}
                <ArrowRight
                  size={12}
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

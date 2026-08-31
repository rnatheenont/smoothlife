"use client";

import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { getProductBySlug } from "@/data/products";
import { useLang } from "@/lib/lang-context";

const KIND_BADGE: Record<string, { th: string; en: string }> = {
  spend: { th: "ซื้อครบฟรี", en: "Spend & get free" },
  bxgy: { th: "ซื้อ 1 แถม 1", en: "Buy & get free" },
  tiered: { th: "ยิ่งซื้อยิ่งได้", en: "Tiered rewards" },
};

// Mirrors src/data/promotions.ts's homepage banner card visual pattern
// exactly, fed by real active free-gift promos instead of the static
// hardcoded array.
export default function FreeGiftPromoCard() {
  const { giftPromos } = useCart();
  const { settings } = useWidgetSettings();
  const { lang } = useLang();

  if (!settings.promotion_card.enabled) return null;
  const active = giftPromos.filter((p) => p.active);
  if (active.length === 0) return null;
  const maxCards = Number(settings.promotion_card.config.maxCards ?? 4);
  const cards = active.slice(0, maxCards);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 my-6 md:my-8">
      {cards.map((promo) => {
        const imgSlug = promo.kind === "tiered" ? promo.tiers?.[0]?.giftProductSlug : promo.giftProductSlug;
        const product = imgSlug ? getProductBySlug(imgSlug) : undefined;
        const badge = KIND_BADGE[promo.kind] ?? KIND_BADGE.spend;
        return (
          <div key={promo.slug} className="relative rounded-xl2 overflow-hidden aspect-4/3 group shadow-card">
            {product && (
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent" />
            <div className="absolute bottom-0 left-0 p-3 md:p-4 text-white">
              <span className="text-[10px] font-bold uppercase bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                {lang === "en" ? badge.en : badge.th}
              </span>
              <h3 className="font-bold text-sm md:text-base mt-1 line-clamp-1">{lang === "en" ? promo.titleEn : promo.titleTh}</h3>
            </div>
          </div>
        );
      })}
    </div>
  );
}

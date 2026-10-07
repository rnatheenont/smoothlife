"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Check, Flame, ShoppingCart, Star } from "lucide-react";
import { Product } from "@/data/types";
import { formatTHB } from "@/lib/format";
import { useCart, useWishlist } from "@/lib/cart-context";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import clsx from "clsx";
import { useLang } from "@/lib/lang-context";
import { HaloRing, RIM } from "@/components/Halo";

// Badges in Thai, and in two voices only. Red is money off — nothing else on
// the card is red, so a red chip always means a discount. Every other badge
// is a quiet white chip. There used to be six colours (sky, violet, amber,
// teal…) with white text, several of them under 3:1, and a corner of the
// card that looked like a sweet shop.
const badgeLabel: Record<string, string> = {
  Bestseller: "ขายดี",
  New: "มาใหม่",
  BOGO: "1 แถม 1",
  Bundle: "เซต",
  Gift: "ของแถม",
};

// What is left for the photo's corner once the discount has moved down to
// the price, where the number it is a percentage of actually is.
//
// Three never make it onto the card. "Sale" says the same thing as that
// chip, one line lower and less precisely. "มาใหม่" is true of most of the
// catalogue at any given moment, so it stopped distinguishing anything.
// "เซต" is already in the product's own name on every set we sell.
//
// A live free-gift promoChip (widget #5, "Promotion badge") comes first
// within the same 2-chip cap — an existing chip may get squeezed out on a
// heavily-badged product, an accepted trade to keep the corner from looking
// like a sweet shop again.
const HIDDEN_ON_CARD = ["Sale", "New", "Bundle"];

function cardBadgeChips(badges: string[] | undefined, promoChip?: string | null) {
  const rest = (badges ?? []).filter((b) => !HIDDEN_ON_CARD.includes(b));
  return (promoChip ? [promoChip, ...rest] : rest).slice(0, 2);
}

/**
 * Units sold the way Thai shoppers read it on every marketplace: exact under a
 * thousand, then พัน / หมื่น — and "k" for English readers, since the page
 * translator would otherwise turn "1.2พัน" into something nobody recognises.
 */
// "ขายแล้ว 3 ชิ้น" reads as a product nobody buys — a small true number does
// more harm than no number. Shown only above this, i.e. from 11 units.
const SHOW_SOLD_ABOVE = 10;

function formatSold(n: number, lang: string) {
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (lang === "en") return n < 1000 ? String(n) : `${trim(n / 1000)}k`;
  if (n < 1000) return n.toLocaleString("th-TH");
  if (n < 10000) return `${trim(n / 1000)}พัน`;
  return `${trim(n / 10000)}หมื่น`;
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem, giftPromos } = useCart();
  const { settings } = useWidgetSettings();
  const { toggle, has } = useWishlist();
  const isInActivePromo =
    settings.promotion_badge.enabled &&
    giftPromos.some(
      (p) =>
        p.active &&
        (p.giftProductSlug === product.slug ||
          (p.buyProductSlugs ?? []).includes(product.slug) ||
          (p.tiers ?? []).some((t) => t.giftProductSlug === product.slug))
    );
  const promoChip = isInActivePromo ? ((settings.promotion_badge.config.labelTh as string) || "ของแถม") : null;
  const isWished = has(product.slug);
  const [added, setAdded] = useState(false);
  // Counts the times this card has been saved, so the animation can be
  // restarted by remounting rather than by waiting for it to finish.
  const [beat, setBeat] = useState(0);
  const { lang, t } = useLang();
  const showSold = (product.sold ?? 0) > SHOW_SOLD_ABOVE;
  const discount = product.compareAtPrice
    ? Math.round(100 - (product.price / product.compareAtPrice) * 100)
    : 0;
  const hasMultiplePrices = product.variants.length > 1 && product.variants.some((v) => v.price !== product.price);
  const defaultVariant = product.variants.find((v) => v.variantId === product.variantId);
  const lowStock =
    typeof defaultVariant?.quantity === "number" && defaultVariant.quantity > 0 && defaultVariant.quantity <= 10;
  const soldOut = !product.inStock;

  function handleWish() {
    const saving = !isWished;
    toggle(product.slug);
    if (saving) setBeat((b) => b + 1);
  }

  function handleAdd() {
    if (soldOut) return;
    addItem(product.slug);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  // The hairline stays on every screen.
  //
  // It was taken off below md on the theory that a photograph and its price
  // are enough to read as one object — true when a card sits on a canvas of a
  // different colour, and not true here: these are white cards inside a white
  // merchandising band, so without the ring they dissolved into it and there
  // was no telling where one product ended. shadow-card is a hairline and a
  // breath of shadow, which is one treatment, not a border and a shadow both.
  return (
    // Two boxes, because the ring has to live outside the one that clips. The
    // card crops its own photo and its own corners with overflow-hidden,
    // which would cut the lights off at exactly the edge they are meant to
    // trace, so the rim is a pixel and a half of padding on a box around it.
    <div className="@container group relative h-full rounded-[17.5px]" style={{ padding: RIM }}>
      <HaloRing radius="rounded-[17.5px]" />
      <div className="relative flex h-full flex-col overflow-hidden rounded-[16px] bg-white shadow-card transition-shadow duration-200 md:rounded-xl2 md:hover:shadow-cardHover">
        {/* The photo fills the square edge to edge, in its own colours. The
            mist well with multiply blending tinted every packshot green-grey
            and shrank it inside padding. No zoom on hover — the card lifting
            its shadow is enough to say it is clickable. */}
        <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-white">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={clsx("object-cover", soldOut && "grayscale opacity-60")}
          />
          {soldOut ? (
            <div className="absolute inset-0 grid place-items-center bg-black/10">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-900/80 text-white">สินค้าหมด</span>
            </div>
          ) : (
            <div className="absolute left-2 top-2 flex flex-wrap gap-1 max-w-[calc(100%-3rem)]">
              {cardBadgeChips(product.badges, promoChip).map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-brand-ink ring-1 ring-surface-line"
                >
                  {badgeLabel[label] ?? label}
                </span>
              ))}
            </div>
          )}
        </Link>
        <div className="flex flex-1 flex-col gap-1.5 p-3 md:p-4">
          {/* Brand leads the card now, the way it does in the design: on a
              shelf of five bottles the vendor is what tells them apart faster
              than the first forty characters of five similar names. */}
          <span translate="no" className="truncate text-[13px] font-bold uppercase text-brand-ink">
            {product.brand}
          </span>
          <Link href={`/product/${product.slug}`}>
            <h3 translate="no" className="line-clamp-2 min-h-9 text-[13px] font-medium leading-snug text-slate-500 transition-colors hover:text-brand-800">
              {product.name}
            </h3>
          </Link>
          {/* Price on the left, proof on the right — money and reputation are
              the two things being weighed, so they sit on one line facing each
              other rather than stacked down the card.
              Sold is real: units counted at build time from paid orders net of
              refunds (fetchUnitsSold in scripts/fetch-products.js), and shown
              only once something has sold — "ขายแล้ว 0 ชิ้น" is a reason not to
              buy, and inventing a number is not an option. */}
          {/* Price and proof face each other on a card with room for it, and
              stack when there is not. A container query, not a breakpoint: the
              same card is 136px in a shelf and 229px in the /shop grid at the
              same screen width.

              10rem is where both halves fit side by side. The price with its
              discount chip measures 76px at its widest and the score with its
              review count 60px, which with the 4px gap is 140px of the 142px
              a 166px card has inside its padding. Two pixels is not a margin
              to trust, so the line the chip sits on wraps rather than pushes:
              a longer price makes the card a line taller instead of printing
              the chip over the star, which is what five stars did here. */}
          <div className="mt-auto flex flex-col items-start gap-1 pt-1.5 @[10rem]:flex-row @[10rem]:items-end @[10rem]:justify-between @[13rem]:gap-2">
            <div className="min-w-0">
              {hasMultiplePrices && <span className="block text-[11px] text-slate-500">เริ่มต้น</span>}
              <span className="block text-base font-bold tabular-nums text-brand-800 md:text-[17px]">
                {formatTHB(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="flex flex-wrap items-center gap-1 @[13rem]:gap-1.5">
                  <span className="text-[11px] tabular-nums text-slate-400 line-through">
                    {formatTHB(product.compareAtPrice)}
                  </span>
                  {discount > 0 && (
                    // Red stays the card's one word for money off, it has just
                    // moved next to the price it is taken from — in the photo's
                    // corner it was a number with nothing beside it to be a
                    // percentage of.
                    <span className="rounded-full bg-sale px-1 py-0.5 text-[10px] font-bold leading-none text-white @[13rem]:px-1.5">
                      -{discount}%
                    </span>
                  )}
                </span>
              )}
            </div>
            {/* Score, then what is left, then how many have gone: all three
                are reasons to buy or to hurry, so they stack in the same
                column facing the price rather than taking a full line each
                across the card. */}
            <div className="flex shrink-0 flex-col items-start gap-0.5 @[10rem]:items-end">
              {product.reviewCount > 0 && (
                // One star and the score, not five stars. Five of them is a
                // picture of a scale, and on a card a third of a phone wide
                // it was a picture 70px long that still needed the count
                // written beside it to mean anything. "4.8 (399)" is the same
                // sentence in a third of the room.
                <span translate="no" className="flex items-center gap-1 text-[11px] tabular-nums text-slate-500">
                  <Star size={11} className="shrink-0 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-slate-700">{product.rating.toFixed(1)}</span>({product.reviewCount})
                </span>
              )}
              {lowStock && (
                <span className="whitespace-nowrap text-[11px] font-semibold text-amber-700">
                  เหลือเพียง {defaultVariant.quantity} ชิ้น
                </span>
              )}
              {showSold && (
                <span translate="no" className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Flame size={11} className="shrink-0 text-orange-500" />
                  {lang === "en" ? (
                    <>
                      <span className="font-semibold text-slate-700">{formatSold(product.sold!, lang)}</span> sold
                    </>
                  ) : (
                    <>
                      ขายแล้ว <span className="font-semibold text-slate-700">{formatSold(product.sold!, lang)}</span> ชิ้น
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
          {/* The buy row. This used to be a 36px round + beside the price,
              deliberately, because a full-width green bar under every card
              turned a grid of products into a grid of green bars — the design
              asks for the bar, so the card keeps the colour to one element and
              the wishlist heart comes down off the photo to share the row
              rather than adding a third accent on the image. */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleWish}
              aria-label={isWished ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
              aria-pressed={isWished}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:text-sale focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600 md:h-10 md:w-10"
            >
              {/* Keyed on the count: a CSS animation only plays when the
                  element is new, and saving the same card twice has to look
                  the same both times. */}
              {beat > 0 && (
                <span
                  key={`ring-${beat}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 animate-heartRing rounded-full border-2 border-sale"
                />
              )}
              <span key={`heart-${beat}`} className={clsx(beat > 0 && "animate-heartPop")}>
                <Heart size={20} className={isWished ? "fill-sale text-sale" : "text-brand-800"} />
              </span>
            </button>
            {soldOut ? (
              <span className="flex h-9 flex-1 items-center justify-center rounded-full bg-slate-100 text-[13px] font-semibold text-slate-500 md:h-10">
                สินค้าหมด
              </span>
            ) : (
              <button
                onClick={handleAdd}
                // The label is a trolley below md, so the button needs the words
                // back for anyone who cannot see the icon.
                aria-label={added ? t("เพิ่มแล้ว", "Added") : t("ใส่ตะกร้า", "Add to cart")}
                className={clsx(
                  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-1 text-[11px] font-bold text-white transition active:scale-[0.97] @[9rem]:text-[13px] md:h-10 md:text-sm",
                  // The drifting gradient needs a background wider than the
                  // button (bg-[length:200%_100%]) or there is nowhere for the
                  // position to travel. Confirmation stays flat: "เพิ่มแล้ว" is
                  // a state, and a state that keeps moving reads as still busy.
                  added
                    ? "bg-brand-emerald"
                    : "animate-gradientPan bg-brand-gradient bg-[length:200%_100%] hover:brightness-105"
                )}
              >
                {added ? <Check size={16} strokeWidth={2.75} /> : <ShoppingCart size={17} className="md:hidden" />}
                {/* On a phone the card is a third of the width it is on a
                    desktop, so the words were down to 11px to fit. The trolley
                    says the same thing at a size that can actually be hit. */}
                <span className="hidden md:inline">
                  {added ? t("เพิ่มแล้ว", "Added") : t("ใส่ตะกร้า", "Add to cart")}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

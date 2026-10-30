"use client";

import { useState, type CSSProperties } from "react";
import { shopifySquare, shopifySquareSrcSet } from "@/lib/shopify-image";
import Link from "next/link";
import { Heart, Check, Flame, ShoppingCart, Star } from "lucide-react";
import type { ProductCardData } from "@/data/card";
import { formatTHB } from "@/lib/format";
import { useCart, useWishlist } from "@/lib/cart-context";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import clsx from "clsx";
import { useLang } from "@/lib/lang-context";
import { HaloRing, RIM } from "@/components/Halo";
import { flyToCart } from "@/lib/fly-to-cart";

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

// The eight pieces of the like burst. Two sizes and two weights of the sale
// red, alternating, so the ring never looks machined.
const SPARKS = [
  "size-1.5 bg-sale",
  "size-1 bg-sale/70",
  "size-1.5 bg-sale/85",
  "size-1 bg-sale/60",
  "size-1.5 bg-sale",
  "size-1 bg-sale/70",
  "size-1.5 bg-sale/85",
  "size-1 bg-sale/60",
];

export default function ProductCard({ product }: { product: ProductCardData }) {
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
  // Both of these were worked out here from the whole variants array, which
  // is why the whole array had to be shipped. They are answers now; see
  // toCardData.
  const hasMultiplePrices = product.multiplePrices;
  const lowStock = product.quantity !== null && product.quantity > 0 && product.quantity <= 10;
  const soldOut = !product.inStock;

  function handleWish() {
    const saving = !isWished;
    toggle(product.slug);
    if (saving) setBeat((b) => b + 1);
  }

  function handleAdd(event: React.MouseEvent<HTMLButtonElement>) {
    if (soldOut) return;
    addItem(product.slug, 1, product.variantId);
    setAdded(true);
    // The photo flies to whichever basket is on screen. Decoration only —
    // the cart already has it by the time this starts.
    flyToCart(event.currentTarget);
    setTimeout(() => setAdded(false), 1500);
  }

  // The hairline stays on every screen.
  //
  // It was taken off below md on the theory that a photograph and its price
  // are enough to read as one object — true when a card sits on a canvas of a
  // different colour, and not true here: these are white cards inside a white
  // merchandising band, so without the ring they dissolved into it and there
  // was no telling where one product ended. shadow-product is a hairline and
  // a lift, which is one treatment, not a border and a shadow both.
  return (
    // Two boxes, because the ring has to live outside the one that clips. The
    // card crops its own photo and its own corners with overflow-hidden,
    // which would cut the lights off at exactly the edge they are meant to
    // trace, so the rim is a pixel and a half of padding on a box around it.
    <div className="@container group relative h-full rounded-[17.5px]" style={{ padding: RIM }}>
      <HaloRing radius="rounded-[17.5px]" />
      {/* The lift on hover has no size condition: Tailwind v4 already scopes
          hover: to @media (hover: hover) — checked in the compiled CSS, the
          rule sits inside that query — so the md: it used to carry was
          standing in for "has a mouse" and getting it wrong on every tablet.

          The md:rounded-xl2 that was here is gone rather than converted:
          --radius-xl2 is 1rem and the base class is rounded-[16px], so it had
          been setting 16px to 16px since the day it was written. */}
      <div className="relative flex h-full flex-col overflow-hidden rounded-[16px] bg-white shadow-product transition-shadow duration-200 hover:shadow-productHover">
        {/* The photo fills the square edge to edge, in its own colours. The
            mist well with multiply blending tinted every packshot green-grey
            and shrank it inside padding. No zoom on hover — the card lifting
            its shadow is enough to say it is clickable. */}
        <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-white">
          {/* A plain img, not next/image, and the reason is srcset.
              `images.unoptimized` is on, so next/image emits a bare <img>
              with one source and drops the `sizes` prop — every phone was
              downloading and decoding the 560px file for a slot drawn at
              163px, and a shop page with a hundred cards on it came to 147 MB
              of decoded image. That is what was killing the tab on iOS.

              Square crops, because the slot is square and object-cover was
              throwing away two thirds of a 560×948 packshot after paying to
              decode all of it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shopifySquare(product.image, 480)}
            srcSet={shopifySquareSrcSet(product.image)}
            sizes="(max-width: 768px) 50vw, (max-width: 1536px) 25vw, 20vw"
            alt={product.name}
            loading="lazy"
            decoding="async"
            className={clsx(
              "absolute inset-0 h-full w-full object-cover",
              soldOut && "grayscale opacity-60",
            )}
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
                  className="rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-brand-ink ring-1 ring-surface-line"
                >
                  {badgeLabel[label] ?? label}
                </span>
              ))}
            </div>
          )}
        </Link>
        {/* Padding follows the card. At p-4 a 166px card has 134px of usable
            width for a two-line product name; at p-3 a 250px card looks
            under-set. Neither has anything to do with the window. */}
        <div className="flex flex-1 flex-col gap-1.5 p-3 @[13rem]:p-4">
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
              the chip over the star, which is what five stars did here.

              Those widths were taken at 11px. The small text is 12px now (11px
              for the chip), which is a few pixels wider each, so on a 166-173px
              card the chip line wraps a little more often. That is the line
              doing what it was written to do; it costs the card up to a row of
              height, not an overlap. */}
          <div className="mt-auto flex flex-col items-start gap-1 pt-1.5 @[10rem]:flex-row @[10rem]:items-end @[10rem]:justify-between @[13rem]:gap-2">
            <div className="min-w-0">
              {hasMultiplePrices && <span className="block text-xs text-slate-500">เริ่มต้น</span>}
              {/* 13rem is where this card already loosens everything else —
                  the badge padding and the row gaps above use the same line,
                  so the price steps up with them rather than on its own. */}
              <span className="block text-base font-bold tabular-nums text-brand-800 @[13rem]:text-[17px]">
                {formatTHB(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="flex flex-wrap items-center gap-1 @[13rem]:gap-1.5">
                  <span className="text-xs tabular-nums text-slate-500 line-through">
                    {formatTHB(product.compareAtPrice)}
                  </span>
                  {discount > 0 && (
                    // Red stays the card's one word for money off, it has just
                    // moved next to the price it is taken from — in the photo's
                    // corner it was a number with nothing beside it to be a
                    // percentage of.
                    <span className="rounded-full bg-sale px-1 py-0.5 text-[11px] font-bold leading-none text-white @[13rem]:px-1.5">
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
                <span translate="no" className="flex items-center gap-1 text-xs tabular-nums text-slate-500">
                  <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-slate-700">{product.rating.toFixed(1)}</span>({product.reviewCount})
                </span>
              )}
              {lowStock && (
                <span className="whitespace-nowrap text-xs font-semibold text-amber-700">
                  เหลือเพียง {product.quantity} ชิ้น
                </span>
              )}
              {showSold && (
                <span translate="no" className="flex items-center gap-1 text-xs text-slate-500">
                  <Flame size={12} className="shrink-0 text-orange-500" />
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
          {/* The buy row: the wishlist heart, and the + that adds to the
              cart. Not a full-width green bar — that turned a grid of
              products into a grid of green bars — and not a control on the
              photo either, so the image keeps its one accent and the heart
              has company on this line rather than sitting on it alone. */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleWish}
              aria-label={isWished ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
              aria-pressed={isWished}
              className="tap-44 relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:text-sale focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600 @[14rem]:h-10 @[14rem]:w-10"
            >
              {/* Keyed on the count: a CSS animation only plays when the
                  element is new, and saving the same card twice has to look
                  the same both times. */}
              {beat > 0 && (
                <>
                  <span
                    key={`ring-${beat}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 animate-heartRing rounded-full border-2 border-sale"
                  />
                  {/* The burst. Eight spokes at 45°, each sized and tinted a
                      little differently — a ring of identical dots reads as a
                      loading spinner, and the point is confetti.

                      Keyed on the count like the pop above: a CSS animation
                      only plays on a new element, so saving a second card has
                      to mount a second set. */}
                  {SPARKS.map((spark, i) => (
                    <span
                      key={`spark-${beat}-${i}`}
                      aria-hidden="true"
                      style={{ "--spark-a": `${i * 45}deg` } as CSSProperties}
                      className={clsx(
                        "pointer-events-none absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] animate-heartSpark rounded-full",
                        spark
                      )}
                    />
                  ))}
                </>
              )}
              <span key={`heart-${beat}`} className={clsx(beat > 0 && "animate-heartPop")}>
                {/* Grey until it means something. Unsaved, it inherits the
                    button's slate — and with it the hover that warms to the
                    sale red, so the colour previews what pressing it does.
                    Saved, it is filled red and says so on its own. */}
                <Heart size={20} className={clsx(isWished && "fill-sale text-sale")} />
              </span>
            </button>
            {soldOut ? (
              <span className="flex h-9 flex-1 items-center justify-center rounded-full bg-slate-100 text-[13px] font-semibold text-slate-500 @[14rem]:h-10">
                สินค้าหมด
              </span>
            ) : (
              <button
                onClick={handleAdd}
                // Icon-only, so the words move into the label: a screen
                // reader now hears which product it belongs to, which the
                // bare "ใส่ตะกร้า" pill never said on a grid of twenty.
                aria-label={
                  added
                    ? t(`เพิ่ม ${product.name} แล้ว`, `Added ${product.name}`)
                    : t(`ใส่ ${product.name} ลงตะกร้า`, `Add ${product.name} to cart`)
                }
                title={added ? t("เพิ่มแล้ว", "Added") : t("ใส่ตะกร้า", "Add to cart")}
                className={clsx(
                  // Where the pill was, at the end of its row, now a round
                  // cart — the same control the staff shop uses, so the two
                  // shops stop looking like two different products. A cart
                  // rather than a +, which only said "add" and left what it
                  // added to for the label to explain.
                  //
                  // One size at every card width. The pill needed container
                  // queries because its label changed length; the icon is the
                  // same at 176px and at 280px, and 40px is the smallest
                  // comfortable target, so the row no longer has a size
                  // condition on it at all.
                  //
                  // Confirmation goes flat: a state that keeps moving reads
                  // as still working.
                  "tap-44 ml-auto grid size-10 shrink-0 place-items-center rounded-full text-white shadow-card transition-[filter,background-color] active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2",
                  added ? "bg-brand-emerald" : "bg-brand-gradient hover:brightness-105"
                )}
              >
                {added ? (
                  <Check className="h-5 w-5" strokeWidth={2.75} aria-hidden />
                ) : (
                  <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

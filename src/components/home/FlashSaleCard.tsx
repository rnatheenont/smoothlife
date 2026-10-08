"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Flame, Heart, ShoppingCart, Star } from "lucide-react";
import clsx from "clsx";
import { Product } from "@/data/types";
import { formatTHB } from "@/lib/format";
import { useCart, useWishlist } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";

// The product card inside the flash sale band.
//
// A separate component rather than a mode of ProductCard: almost nothing of
// the ordinary card survives here. The photo sits in a red frame, a flame
// badge hangs off its corner, and a bar under it says how many have gone —
// three pieces of furniture that exist only because the campaign is counting
// down, and that would be dead props on every other shelf on the site.
//
// What it does keep is the site's own two rules about cards, which are newer
// than the mock: the score is one star and a number rather than five stars,
// and the buy button is a trolley on a phone and words from md up. A card in
// this rail is 166px wide on a phone, which is where both of those rules came
// from in the first place.

const FLASH_RED = "#e8201a";

/** The designer's frame: a red border with the flame badge already in it,
 *  transparent through the middle. Drawn over the photo when the file is
 *  there; the CSS frame below stands in when it is not, so a missing asset
 *  costs the card its polish rather than its picture. */
const FRAME_SRC = "/flash-sale/frame.png";
/** The frame's border measures 17px of its 474, i.e. 3.6%. The photo is
 *  inset by a shade less than that so the border sits ON its edge: a hair of
 *  overlap is invisible, a hair of gap is a white line all the way round. */
const FRAME_INSET = "3.4%";

export default function FlashSaleCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const { t } = useLang();
  const [added, setAdded] = useState(false);
  const [beat, setBeat] = useState(0);
  const [frameOk, setFrameOk] = useState(true);

  const isWished = has(product.slug);
  const soldOut = !product.inStock;
  const discount = product.compareAtPrice
    ? Math.round(100 - (product.price / product.compareAtPrice) * 100)
    : 0;

  const sold = product.sold ?? 0;
  const defaultVariant = product.variants.find((v) => v.variantId === product.variantId);
  const remaining = typeof defaultVariant?.quantity === "number" ? defaultVariant.quantity : null;
  // Real arithmetic or nothing: a bar at a made-up percentage is a lie about
  // how much is left, which is the one thing this bar is for.
  const pct =
    remaining !== null && sold + remaining > 0
      ? Math.min(100, Math.max(6, Math.round((sold / (sold + remaining)) * 100)))
      : null;

  function handleAdd() {
    if (soldOut) return;
    addItem(product.slug);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleWish() {
    const saving = !isWished;
    toggle(product.slug);
    if (saving) setBeat((b) => b + 1);
  }

  return (
    <article className="@container flex h-full flex-col overflow-hidden rounded-[14px] bg-white">
      <Link href={`/product/${product.slug}`} className="relative block">
        {frameOk ? (
          <span className="relative block aspect-square">
            <span className="absolute overflow-hidden bg-white" style={{ inset: FRAME_INSET }}>
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className={clsx("object-cover", soldOut && "opacity-60 grayscale")}
              />
            </span>
            <Image
              src={FRAME_SRC}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="pointer-events-none object-contain"
              onError={() => setFrameOk(false)}
            />
          </span>
        ) : (
          <span className="relative block p-1.5" style={{ background: FLASH_RED }}>
            <span className="relative block aspect-square overflow-hidden rounded-[8px] bg-white">
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className={clsx("object-cover", soldOut && "opacity-60 grayscale")}
              />
            </span>
            <span
              className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[10px] font-bold text-white @[9rem]:text-[11px]"
              style={{ background: FLASH_RED }}
            >
              <span className="grid size-4 place-items-center rounded-full bg-white/25">
                <Flame size={10} className="fill-amber-300 text-amber-300" />
              </span>
              Flash Sale
            </span>
          </span>
        )}
      </Link>

      {sold > 0 && (
        <div className="relative mx-2 mt-2 h-4 overflow-hidden rounded-full bg-rose-100">
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
            style={{ width: `${pct ?? 100}%`, background: FLASH_RED }}
          />
          <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-white">
            {t(`ขายแล้ว ${sold}`, `${sold} sold`)}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2">
        <Link href={`/product/${product.slug}`} className="block">
          <h3 className="line-clamp-2 text-[12px] leading-snug text-slate-600 @[9rem]:text-[13px]">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto pt-2">
          <div className="flex items-end justify-between gap-1.5">
            <span className="text-base font-extrabold tabular-nums text-brand-emerald @[9rem]:text-lg">
              {formatTHB(product.price)}
            </span>
            {product.reviewCount > 0 && (
              <span translate="no" className="flex items-center gap-1 text-[11px] tabular-nums text-slate-500">
                <Star size={11} className="shrink-0 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-slate-700">{product.rating.toFixed(1)}</span>({product.reviewCount})
              </span>
            )}
          </div>
          {product.compareAtPrice && (
            <span className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] tabular-nums text-slate-400 line-through">
                {formatTHB(product.compareAtPrice)}
              </span>
              {discount > 0 && (
                <span className="rounded-full bg-brand-ink px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {discount}%
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-2">
          <button
            onClick={handleWish}
            aria-label={isWished ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
            aria-pressed={isWished}
            className="relative grid size-8 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:text-sale md:size-9"
          >
            {beat > 0 && (
              <span
                key={`ring-${beat}`}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 animate-heartRing rounded-full border-2 border-sale"
              />
            )}
            <span key={`heart-${beat}`} className={clsx(beat > 0 && "animate-heartPop")}>
              <Heart size={17} className={isWished ? "fill-sale text-sale" : "text-brand-800"} />
            </span>
          </button>

          {soldOut ? (
            <span className="flex h-8 flex-1 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-500 md:h-9">
              สินค้าหมด
            </span>
          ) : (
            <button
              onClick={handleAdd}
              aria-label={added ? t("เพิ่มแล้ว", "Added") : t("ใส่ตะกร้า", "Add to cart")}
              className={clsx(
                "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-1 text-[12px] font-bold text-white transition active:scale-[0.97] md:h-9 md:text-[13px]",
                added ? "bg-brand-emerald" : "bg-brand-emerald hover:brightness-105"
              )}
            >
              {added ? <Check size={15} strokeWidth={2.75} /> : <ShoppingCart size={16} className="md:hidden" />}
              <span className="hidden md:inline">
                {added ? t("เพิ่มแล้ว", "Added") : t("ใส่ตะกร้า", "Add to cart")}
              </span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

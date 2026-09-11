"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Plus, Check, Flame } from "lucide-react";
import { Product } from "@/data/types";
import { formatTHB } from "@/lib/format";
import StarRating from "./StarRating";
import { useCart, useWishlist } from "@/lib/cart-context";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import clsx from "clsx";
import { useLang } from "@/lib/lang-context";

const badgeStyles: Record<string, string> = {
  Bestseller: "bg-brand-emerald text-white",
  New: "bg-brand-sky text-white",
  Sale: "bg-rose-500 text-white",
  BOGO: "bg-violet-500 text-white",
  Bundle: "bg-amber-500 text-white",
  Gift: "bg-brand-teal text-white",
};

// A discount % and a "Sale" badge say the same thing, so the discount
// chip (more specific) replaces "Sale" rather than stacking on top of
// it — keeps the corner to at most 2 chips instead of 3 crowded pills. A
// live free-gift promoChip (widget #5, "Promotion badge") takes priority
// within that same 2-chip cap — an existing chip may get squeezed out on a
// heavily-badged product, an accepted trade to preserve the density rule.
function cardBadgeChips(badges: string[] | undefined, discount: number, promoChip?: string | null) {
  const rest = (badges ?? []).filter((b) => b !== "Sale").slice(0, 2);
  const chips = discount > 0 ? [`-${discount}%`, ...rest] : rest;
  return (promoChip ? [promoChip, ...chips] : chips).slice(0, 2);
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
  const { lang } = useLang();
  const showSold = (product.sold ?? 0) > SHOW_SOLD_ABOVE;
  const discount = product.compareAtPrice
    ? Math.round(100 - (product.price / product.compareAtPrice) * 100)
    : 0;
  const hasMultiplePrices = product.variants.length > 1 && product.variants.some((v) => v.price !== product.price);
  const defaultVariant = product.variants.find((v) => v.variantId === product.variantId);
  const lowStock =
    typeof defaultVariant?.quantity === "number" && defaultVariant.quantity > 0 && defaultVariant.quantity <= 10;
  const soldOut = !product.inStock;

  function handleAdd() {
    if (soldOut) return;
    addItem(product.slug);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="group relative flex h-full flex-col rounded-xl2 bg-white shadow-card hover:shadow-cardHover transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      <button
        onClick={() => toggle(product.slug)}
        aria-label="Add to wishlist"
        className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur shadow-sm hover:scale-105 transition-transform"
      >
        <Heart size={16} className={isWished ? "fill-rose-500 text-rose-500" : "text-slate-400"} />
      </button>
      <Link href={`/product/${product.slug}`} className="block relative aspect-square bg-surface-soft overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className={clsx(
            "object-cover transition-transform duration-500",
            soldOut ? "grayscale opacity-60" : "group-hover:scale-105"
          )}
        />
        {soldOut ? (
          <div className="absolute inset-0 grid place-items-center bg-black/10">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-900/80 text-white">สินค้าหมด</span>
          </div>
        ) : (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1 max-w-[calc(100%-3rem)]">
            {cardBadgeChips(product.badges, discount, promoChip).map((label) => (
              <span
                key={label}
                className={clsx(
                  "text-[10px] font-bold px-2 py-1 rounded-full shadow-sm",
                  label.startsWith("-")
                    ? "bg-rose-500 text-white"
                    : label === promoChip
                    ? "bg-brand-teal text-white"
                    : badgeStyles[label] || "bg-slate-700 text-white"
                )}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3 md:p-4">
        <span translate="no" className="text-[11px] font-semibold uppercase tracking-wide text-brand-teal">{product.brand}</span>
        <Link href={`/product/${product.slug}`}>
          <h3 translate="no" className="text-sm font-medium text-brand-ink line-clamp-2 min-h-[2.5rem] hover:text-brand-emerald transition-colors">
            {product.name}
          </h3>
        </Link>
        {product.reviewCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <StarRating rating={product.rating} size={12} />
            <span className="text-[11px] text-slate-400">({product.reviewCount})</span>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 line-clamp-1">{product.shortDesc}</p>
        )}
        {/* Sold and stock share one line: they answer the same question —
            "is this popular, and will it still be here" — and two short lines
            cost the card height it does not have.
            Sold is real: units counted at build time from paid orders net of
            refunds (fetchUnitsSold in scripts/fetch-products.js), and shown
            only once something has sold — "ขายแล้ว 0 ชิ้น" is a reason not to
            buy, and inventing a number is not an option. */}
        {(showSold || lowStock) && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
            {showSold && (
              <span translate="no" className="flex items-center gap-1 text-slate-500">
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
            {showSold && lowStock && (
              <span aria-hidden="true" className="text-slate-300">·</span>
            )}
            {lowStock && (
              <span className="font-semibold text-amber-600">เหลือเพียง {defaultVariant.quantity} ชิ้น</span>
            )}
          </p>
        )}
        {/* Price and the add button share one row: the full-width button
            under every card turned a grid of products into a grid of green
            bars, and it was the tallest thing on the card. */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            {hasMultiplePrices && <span className="text-xs text-slate-400">เริ่มต้น</span>}
            <span className="text-base font-bold text-brand-ink">{formatTHB(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-xs text-slate-400 line-through">{formatTHB(product.compareAtPrice)}</span>
            )}
          </div>
          {soldOut ? (
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">
              สินค้าหมด
            </span>
          ) : (
            <button
              onClick={handleAdd}
              aria-label={added ? "เพิ่มลงตะกร้าแล้ว" : `เพิ่ม ${product.name} ลงตะกร้า`}
              title={added ? "เพิ่มแล้ว" : "เพิ่มลงตะกร้า"}
              className={clsx(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-card transition-all hover:shadow-cardHover active:scale-90",
                added ? "bg-brand-emerald" : "bg-brand-gradient hover:brightness-105"
              )}
            >
              {added ? <Check size={17} strokeWidth={2.75} /> : <Plus size={18} strokeWidth={2.75} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

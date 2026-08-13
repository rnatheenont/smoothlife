"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, Check } from "lucide-react";
import { Product } from "@/data/types";
import { formatTHB } from "@/lib/format";
import StarRating from "./StarRating";
import { useCart, useWishlist } from "@/lib/cart-context";
import clsx from "clsx";

const badgeStyles: Record<string, string> = {
  Bestseller: "bg-brand-emerald text-white",
  New: "bg-brand-sky text-white",
  Sale: "bg-rose-500 text-white",
  BOGO: "bg-violet-500 text-white",
  Bundle: "bg-amber-500 text-white",
};

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const isWished = has(product.slug);
  const [added, setAdded] = useState(false);
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
    <div className="group relative flex flex-col rounded-xl2 bg-white shadow-card hover:shadow-cardHover transition-shadow duration-300 overflow-hidden border border-slate-100">
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
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {product.badges?.slice(0, 2).map((b) => (
              <span key={b} className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", badgeStyles[b])}>
                {b}
              </span>
            ))}
            {discount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                -{discount}%
              </span>
            )}
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3 md:p-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-teal">{product.brand}</span>
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-sm font-medium text-brand-ink line-clamp-2 min-h-[2.5rem] hover:text-brand-emerald transition-colors">
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
        {lowStock && <p className="text-[11px] font-semibold text-amber-600">เหลือเพียง {defaultVariant.quantity} ชิ้น</p>}
        <div className="mt-1 flex items-baseline gap-2">
          {hasMultiplePrices && <span className="text-xs text-slate-400">เริ่มต้น</span>}
          <span className="text-base font-bold text-brand-ink">{formatTHB(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-xs text-slate-400 line-through">{formatTHB(product.compareAtPrice)}</span>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={soldOut}
          className={clsx(
            "mt-2 flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold py-2 transition-all active:scale-95",
            soldOut
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : clsx("text-white", added ? "bg-brand-emerald" : "bg-brand-gradient hover:opacity-90")
          )}
        >
          {soldOut ? null : added ? <Check size={14} /> : <ShoppingBag size={14} />}
          {soldOut ? "สินค้าหมด" : added ? "เพิ่มแล้ว" : "เพิ่มลงตะกร้า"}
        </button>
      </div>
    </div>
  );
}

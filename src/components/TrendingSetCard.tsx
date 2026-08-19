"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flame, ShoppingBag, Check } from "lucide-react";
import { Product } from "@/data/types";
import { formatTHB } from "@/lib/format";
import StarRating from "./StarRating";
import { useCart } from "@/lib/cart-context";
import clsx from "clsx";

const rankStyles: Record<number, string> = {
  1: "bg-gradient-to-br from-amber-300 to-amber-500 text-white",
  2: "bg-gradient-to-br from-slate-300 to-slate-400 text-white",
  3: "bg-gradient-to-br from-orange-300 to-orange-500 text-white",
};

export default function TrendingSetCard({ product, rank }: { product: Product; rank: number }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const discount = product.compareAtPrice
    ? Math.round(100 - (product.price / product.compareAtPrice) * 100)
    : 0;

  function handleAdd() {
    addItem(product.slug);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="group relative flex flex-col rounded-xl2 bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden transition-all hover:border-brand-sky/50 hover:bg-white/[0.1]">
      <div
        className={clsx(
          "absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold shadow-lg",
          rankStyles[rank] || "bg-white/20 text-white backdrop-blur"
        )}
      >
        {rank}
      </div>
      {rank <= 3 && (
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white animate-glowPulse">
          <Flame size={11} className="fill-white" /> เทรนด์
        </span>
      )}
      <Link href={`/product/${product.slug}`} className="relative aspect-square bg-white/5 overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 55vw, 22vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {discount > 0 && (
          <span className="absolute bottom-2 left-2 rounded-full bg-brand-ink/90 px-2 py-0.5 text-[10px] font-bold text-white">
            คุ้มกว่า -{discount}%
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-sky">{product.brand}</span>
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-sm font-medium text-white line-clamp-2 min-h-[2.5rem] group-hover:text-brand-sky transition-colors">
            {product.name}
          </h3>
        </Link>
        {product.reviewCount > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={product.rating} size={12} />
            <span className="text-[11px] text-white/50">({product.reviewCount})</span>
          </div>
        )}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-bold text-white">{formatTHB(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-xs text-white/40 line-through">{formatTHB(product.compareAtPrice)}</span>
          )}
        </div>
        <button
          onClick={handleAdd}
          className={clsx(
            "mt-2 flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold py-2 transition-all active:scale-95 text-white",
            added ? "bg-brand-emerald" : "bg-brand-gradient hover:opacity-90"
          )}
        >
          {added ? <Check size={14} /> : <ShoppingBag size={14} />}
          {added ? "เพิ่มแล้ว" : "เพิ่มลงตะกร้า"}
        </button>
      </div>
    </div>
  );
}

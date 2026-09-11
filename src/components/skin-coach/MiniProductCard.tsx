"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { Product } from "@/data/types";
import { formatTHB } from "@/lib/format";
import { useCart } from "@/lib/cart-context";

/**
 * A recommendation sized to sit under one scan finding: photo, brand, name,
 * price, and add. The full shop card carries stock, sold counts, badges and a
 * wishlist heart — right for browsing, too much for three picks tucked under
 * "สิว"; those details are one tap away on the product page.
 */
export default function MiniProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const discount = product.compareAtPrice ? Math.round(100 - (product.price / product.compareAtPrice) * 100) : 0;
  const fromPrice = product.variants.length > 1 && product.variants.some((v) => v.price !== product.price);
  const href = `/product/${product.slug}`;

  function add() {
    addItem(product.slug);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="w-32 shrink-0 snap-start sm:w-36">
      <div className="relative">
        <Link href={href} className="relative block aspect-square overflow-hidden rounded-xl border border-surface-line bg-white">
          <Image src={product.image} alt={product.name} fill sizes="144px" className="object-cover" />
          {discount > 0 && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-sale px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
              -{discount}%
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={add}
          aria-label={added ? `เพิ่ม ${product.name} ลงตะกร้าแล้ว` : `เพิ่ม ${product.name} ลงตะกร้า`}
          className="absolute -bottom-3 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-white shadow-md ring-2 ring-white transition-transform active:scale-95"
        >
          {added ? <Check size={15} /> : <Plus size={16} />}
        </button>
      </div>
      <Link href={href} className="mt-3.5 block">
        <p className="truncate text-[11px] text-slate-500" translate="no">
          {product.brand}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-brand-ink" translate="no">
          {product.name}
        </p>
      </Link>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        {fromPrice && <span className="text-[10px] text-slate-500">เริ่มต้น</span>}
        <span className="text-sm font-bold text-brand-ink tabular-nums">{formatTHB(product.price)}</span>
        {product.compareAtPrice && (
          <span className="text-[11px] text-slate-500 line-through tabular-nums">{formatTHB(product.compareAtPrice)}</span>
        )}
      </p>
    </div>
  );
}

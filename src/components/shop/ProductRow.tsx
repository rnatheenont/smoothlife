"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { Check, Heart, ShoppingCart } from "lucide-react";
import type { Product } from "@/data/types";
import { formatTHB } from "@/lib/format";
import { useCart, useWishlist } from "@/lib/cart-context";
import StarRating from "@/components/StarRating";

/** The list view's row — the same facts as the card, read left to right. */
export default function ProductRow({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const [added, setAdded] = useState(false);
  const wished = has(product.slug);
  const discount = product.compareAtPrice ? Math.round(100 - (product.price / product.compareAtPrice) * 100) : 0;
  const href = `/product/${product.slug}`;

  return (
    <div className="flex gap-4 rounded-xl2 bg-white p-3 shadow-card ring-1 ring-surface-line md:p-4">
      <Link href={href} className="relative block h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-white md:h-32 md:w-32">
        <Image src={product.image} alt={product.name} fill sizes="128px" className="object-cover" />
        {discount > 0 && (
          <span className="absolute left-1 top-1 rounded-md bg-sale px-1.5 py-0.5 text-[11px] font-bold text-white">
            -{discount}%
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <span translate="no" className="text-xs text-slate-500">
          {product.brand}
        </span>
        <Link href={href} className="mt-0.5">
          <h3 translate="no" className="line-clamp-2 font-semibold leading-snug text-brand-ink hover:text-brand-800">
            {product.name}
          </h3>
        </Link>
        {product.shortDesc && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.shortDesc}</p>}
        {product.reviewCount > 0 && (
          <span className="mt-1.5 flex items-center gap-1.5">
            <StarRating rating={product.rating} size={13} />
            <span className="text-xs text-slate-500">({product.reviewCount})</span>
          </span>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-bold tabular-nums text-brand-ink">{formatTHB(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-xs tabular-nums text-slate-400 line-through">{formatTHB(product.compareAtPrice)}</span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => toggle(product.slug)}
              aria-label={wished ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
              aria-pressed={wished}
              className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-surface-line"
            >
              <Heart size={18} className={clsx(wished ? "fill-sale text-sale" : "text-slate-500")} />
            </button>
            <button
              type="button"
              onClick={() => {
                addItem(product.slug);
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
              aria-label={`เพิ่ม ${product.name} ลงตะกร้า`}
              className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white shadow-md transition active:scale-95"
            >
              {added ? <Check size={18} strokeWidth={2.5} /> : <ShoppingCart size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

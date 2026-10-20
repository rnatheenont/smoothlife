"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { shopifyImage } from "@/lib/shopify-image";
import { formatTHB } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";

// A product as a line, not a card.
//
// This is the shape the assistant has always used in a chat bubble: a
// thumbnail, the name, the price, and one button. It reads as a reference
// inside someone else's sentence rather than as a thing competing with the
// sentence for attention, which is why the FAQ answers use it too — an answer
// about sensitive teeth is the point of that page, and three full product
// cards under two lines of text invert that.
//
// Lives here rather than in the chat because it now has two callers. The
// version in the chat bubble was the original; copying its markup into the
// FAQ would have left two of them to keep in step.

/** What both callers can supply — the chat's LiteProduct and the catalogue's
 *  ProductCardData are both wider than this and both fit. */
export type ProductRowData = {
  slug: string;
  name: string;
  image: string;
  price: number;
  compareAtPrice?: number;
  variantId: string;
};

export default function ProductRow({ product, className = "" }: { product: ProductRowData; className?: string }) {
  const { addItem } = useCart();
  const { t } = useLang();
  const [added, setAdded] = useState(false);

  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xs ${className}`}>
      <Link href={`/product/${product.slug}`} className="relative block h-14 w-14 shrink-0">
        <Image
          src={shopifyImage(product.image, 112)}
          alt={product.name}
          fill
          sizes="56px"
          className="rounded-lg bg-surface-soft object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/product/${product.slug}`}
          translate="no"
          className="block line-clamp-2 text-[12px] font-semibold leading-snug text-brand-ink hover:text-brand-800"
        >
          {product.name}
        </Link>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[12px] font-bold text-brand-800">{formatTHB(product.price)}</span>
          {product.compareAtPrice ? (
            <span className="text-[10px] text-slate-500 line-through">{formatTHB(product.compareAtPrice)}</span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          addItem(product.slug, 1, product.variantId);
          setAdded(true);
        }}
        aria-label={t("เพิ่มลงตะกร้า", "Add to cart")}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition-colors ${
          added ? "bg-slate-300" : "bg-brand-gradient"
        }`}
      >
        {added ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </div>
  );
}

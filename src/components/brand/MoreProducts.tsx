"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { cardFromLite } from "@/data/cart-product";
import { inSlugOrder, useLiteProducts } from "@/lib/use-lite-products";

// The rest of a shelf, fetched when somebody asks for it.
//
// A brand page used to arrive with every card of every shelf drawn into the
// HTML — 75 of them on Dentiste, most of them below the fold and most of
// them never looked at. A card is about 5 KB of markup; its slug is forty
// bytes. So the page now carries one row per shelf and the slugs of the
// rest, and this fetches those few products when the button is pressed.
//
// The button is a button, not a scroll trick: a shelf that fills itself as
// you pass it moves the page under the person reading it, and the ones
// below shift down by a row each time.

export default function MoreProducts({ slugs, label }: { slugs: string[]; label: string }) {
  const [asked, setAsked] = useState(false);
  const { products, loading } = useLiteProducts(asked ? slugs : []);
  const cards = inSlugOrder(products, slugs);

  if (slugs.length === 0) return null;

  if (!asked) {
    return (
      <button
        type="button"
        onClick={() => setAsked(true)}
        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl2 border border-dashed border-surface-line text-[13px] font-semibold text-brand-800 transition-colors hover:border-brand-teal hover:bg-surface-soft"
      >
        <Plus size={15} aria-hidden="true" /> {label} ({slugs.length})
      </button>
    );
  }

  if (loading && cards.length === 0) {
    return (
      <p className="mt-3 flex h-11 items-center justify-center gap-2 text-[13px] text-slate-500">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> กำลังโหลด…
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 md:mt-5 md:grid-cols-4 md:gap-5 xl:grid-cols-5">
      {cards.map((p) => (
        <ProductCard key={p.slug} product={cardFromLite(p)} />
      ))}
    </div>
  );
}

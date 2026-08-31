"use client";

import { useState } from "react";
import Image from "next/image";
import { products } from "@/data/products";
import { formatTHB } from "@/lib/format";

const MAX_RESULTS = 8;

// Type-to-filter product picker for admin forms — forked from
// SearchSuggestions.tsx's filter logic, but selects into a form field via
// onSelect(slug) instead of navigating via <Link>.
export default function ProductPicker({ onSelect }: { onSelect: (slug: string) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? products
        .filter(
          (p) =>
            p.inStock &&
            (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
        )
        .slice(0, MAX_RESULTS)
    : [];

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="พิมพ์ชื่อสินค้าเพื่อค้นหา..."
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
      />
      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-slate-100 bg-white shadow-cardHover overflow-hidden z-20 max-h-72 overflow-y-auto">
          {matches.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => {
                onSelect(p.slug);
                setQuery("");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-surface-soft transition-colors text-left"
            >
              <span className="relative h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                <Image src={p.image} alt={p.name} fill sizes="36px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-slate-400 truncate">{p.brand}</span>
                <span className="block text-sm text-brand-ink line-clamp-1">{p.name}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-slate-500">{formatTHB(p.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

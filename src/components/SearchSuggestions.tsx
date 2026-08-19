"use client";

import Image from "next/image";
import Link from "next/link";
import { products } from "@/data/products";
import { formatTHB } from "@/lib/format";

const MAX_RESULTS = 6;

// Live results as the shopper types — same substring match already used by
// /search (name/brand/shortDesc), just capped short and rendered inline
// under the input instead of waiting for a submit + page navigation.
export default function SearchSuggestions({ query, onSelect }: { query: string; onSelect: () => void }) {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const matches = products
    .filter(
      (p) =>
        p.inStock &&
        (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.shortDesc.toLowerCase().includes(q))
    )
    .slice(0, MAX_RESULTS);

  return (
    <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-slate-100 bg-white shadow-cardHover overflow-hidden z-50 text-left">
      {matches.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400">ไม่พบสินค้าที่ตรงกับ &ldquo;{query}&rdquo;</p>
      ) : (
        <>
          <ul className="max-h-[70vh] overflow-y-auto">
            {matches.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/product/${p.slug}`}
                  onClick={onSelect}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-soft transition-colors"
                >
                  <span className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                    <Image src={p.image} alt={p.name} fill sizes="44px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-brand-teal uppercase truncate">{p.brand}</span>
                    <span className="block text-sm text-brand-ink line-clamp-1">{p.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-brand-ink">{formatTHB(p.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/search?q=${encodeURIComponent(query.trim())}`}
            onClick={onSelect}
            className="block text-center text-sm font-semibold text-brand-emerald hover:text-brand-sky py-3 border-t border-slate-50"
          >
            ดูผลการค้นหาทั้งหมดสำหรับ &ldquo;{query.trim()}&rdquo;
          </Link>
        </>
      )}
    </div>
  );
}

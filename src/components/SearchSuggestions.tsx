"use client";

import Image from "next/image";
import Link from "next/link";
import { products } from "@/data/products";
import { brands } from "@/data/brands";
import { formatTHB } from "@/lib/format";

const MAX_RESULTS = 6;
/** Two is enough to answer "do you carry this brand"; more and the brands
 *  push the products people are actually scanning off the bottom. */
const MAX_BRANDS = 2;

// Live results as the shopper types — same substring match already used by
// /search (name/brand/shortDesc), just capped short and rendered inline
// under the input instead of waiting for a submit + page navigation.
//
// Brands come first and separately. Typing "cerave" used to return six
// CeraVe products and no way to see the other twenty, which is the wrong
// answer to a brand name: the shop has a page for that.
export default function SearchSuggestions({
  query,
  onSelect,
  limit = MAX_RESULTS,
}: {
  query: string;
  onSelect: () => void;
  /** Fewer where the field sits low on the page and a long list would open
   *  past the bottom of the window. */
  limit?: number;
}) {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const brandHits = brands.filter((b) => b.name.toLowerCase().includes(q)).slice(0, MAX_BRANDS);

  const matches = products
    .filter(
      (p) =>
        p.inStock &&
        (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.shortDesc.toLowerCase().includes(q))
    )
    .slice(0, limit);

  return (
    <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white shadow-cardHover overflow-hidden z-50 text-left">
      {matches.length === 0 && brandHits.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">ไม่พบสินค้าที่ตรงกับ &ldquo;{query}&rdquo;</p>
      ) : (
        <>
          {brandHits.length > 0 && (
            <ul className="border-b border-slate-50">
              {brandHits.map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/brands/${b.slug}`}
                    onClick={onSelect}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-soft"
                  >
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-slate-100">
                      <Image src={b.image} alt="" fill sizes="44px" className="object-contain p-1" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold text-slate-400">แบรนด์</span>
                      <span translate="no" className="block truncate text-sm font-semibold text-brand-ink">
                        {b.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{b.productCount} รายการ</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
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
                    <span translate="no" className="block text-xs font-semibold text-brand-800 truncate">{p.brand}</span>
                    <span translate="no" className="block text-sm text-brand-ink line-clamp-1">{p.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-brand-ink">{formatTHB(p.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/search?q=${encodeURIComponent(query.trim())}`}
            onClick={onSelect}
            className="block text-center text-sm font-semibold text-brand-800 hover:text-brand-800 py-3 border-t border-slate-50"
          >
            ดูผลการค้นหาทั้งหมดสำหรับ &ldquo;{query.trim()}&rdquo;
          </Link>
        </>
      )}
    </div>
  );
}

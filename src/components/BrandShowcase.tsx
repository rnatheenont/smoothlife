"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Brand, Product } from "@/data/types";
import ProductCard from "./ProductCard";

// The "Life So Smooth" house-brand story — replaces what used to be a
// separate brand-story block plus one full carousel section per brand
// (up to 4 stacked sections) with a single section switched by brand tab,
// always in the fixed priority order Smooth E > Smooth Life > Dentiste.
export default function BrandShowcase({
  brands,
  productsBySlug,
}: {
  brands: Brand[];
  productsBySlug: Record<string, Product[]>;
}) {
  const [active, setActive] = useState(0);
  if (brands.length === 0) return null;
  const brand = brands[Math.min(active, brands.length - 1)];
  const brandProducts = (productsBySlug[brand.slug] || []).slice(0, 8);

  return (
    <section className="bg-brand-gradient-soft py-14 md:py-20">
      <div className="container-page">
        <div className="text-center max-w-xl mx-auto mb-7">
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-emerald shadow-card mb-3">
            Our House Brands
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-brand-ink">Life So Smooth</h2>
          <p className="mt-2 text-slate-600">3 แบรนด์ในเครือที่คัดสรรเพื่อไลฟ์สไตล์ที่สมูทขึ้นทุกวัน</p>
        </div>

        <div className="flex justify-center flex-wrap gap-2.5 md:gap-3 mb-2">
          {brands.map((b, i) => (
            <button
              key={b.slug}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2.5 rounded-full pl-2 pr-4 py-2 border-2 transition-all ${
                i === active
                  ? "border-brand-emerald bg-white shadow-cardHover"
                  : "border-transparent bg-white/60 hover:bg-white"
              }`}
            >
              {b.image && (
                <span className="relative h-8 w-8 rounded-full bg-white overflow-hidden shrink-0">
                  <Image src={b.image} alt={b.name} fill className="object-contain p-1" sizes="32px" />
                </span>
              )}
              <span className="text-sm font-bold text-brand-ink">{b.name}</span>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500 mb-6">{brand.tagline}</p>

        {brandProducts.length > 0 ? (
          <>
            <div className="flex gap-3 md:gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 -mx-4 px-4 md:mx-0 md:px-0">
              {brandProducts.map((p) => (
                <div key={p.slug} className="shrink-0 snap-start w-[45vw] sm:w-56 md:w-64">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
            <div className="text-center mt-5">
              <Link
                href={`/shop?brand=${brand.slug}`}
                className="text-sm font-semibold text-brand-emerald hover:text-brand-sky transition-colors"
              >
                ดูสินค้าทั้งหมดของ {brand.name} →
              </Link>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-slate-400">เร็วๆ นี้จะมีสินค้าเพิ่มเติม</p>
        )}
      </div>
    </section>
  );
}

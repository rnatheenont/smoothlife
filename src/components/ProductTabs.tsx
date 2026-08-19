"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Product } from "@/data/types";
import TrendingSetCard from "./TrendingSetCard";
import ScrollReveal from "./ScrollReveal";

export type ProductTab = { label: string; products: Product[]; flame?: boolean };

// Consolidates what used to be 4 separate stacked sections (Best Sellers,
// On Sale, New Arrivals, Bundle Deals) into one — same dark "hot right
// now" treatment as the old bundles section, switched by tab instead of
// scrolling past four near-identical product rows.
export default function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const nonEmpty = tabs.filter((t) => t.products.length > 0);
  const [active, setActive] = useState(0);
  if (nonEmpty.length === 0) return null;
  const current = nonEmpty[Math.min(active, nonEmpty.length - 1)];

  return (
    <section className="relative overflow-hidden bg-brand-ink py-10 md:py-14">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-teal/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-brand-sky/20 blur-3xl" />
      <div className="container-page relative">
        <ScrollReveal>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">สินค้าแนะนำ</h2>
            <Link
              href="/shop"
              className="hidden sm:flex items-center gap-1 text-sm font-medium text-brand-sky hover:text-white transition-colors shrink-0"
            >
              ดูทั้งหมด <ChevronRight size={16} />
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none mb-5 md:mb-6">
            {nonEmpty.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setActive(i)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  i === active ? "bg-white text-brand-ink shadow-card" : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </ScrollReveal>
        <div key={current.label} className="flex gap-3 md:gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1">
          {current.products.map((p, i) => (
            <div key={p.slug} className="shrink-0 snap-start w-[45vw] sm:w-56 md:w-64">
              <TrendingSetCard product={p} rank={i + 1} showFlame={current.flame ?? true} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

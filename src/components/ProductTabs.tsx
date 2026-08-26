"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "@/data/types";
import ProductCard from "./ProductCard";
import ScrollReveal from "./ScrollReveal";

export type ProductTab = { label: string; products: Product[] };

// Consolidates what used to be 4 separate stacked sections (Best Sellers,
// On Sale, New Arrivals, Bundle Deals) into one tabbed row, switched by tab
// instead of scrolling past four near-identical product rows.
export default function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const nonEmpty = tabs.filter((t) => t.products.length > 0);
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  if (nonEmpty.length === 0) return null;
  const current = nonEmpty[Math.min(active, nonEmpty.length - 1)];

  function updateProgress() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  }

  function scrollByCard(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? 240) + 16;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <section className="bg-white py-6 md:py-20 overflow-hidden">
      <ScrollReveal className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-brand-ink">สินค้าแนะนำ</h2>
            <p className="mt-1 text-sm text-slate-500">คัดมาให้แล้วจากสิ่งที่ลูกค้าชอบที่สุด</p>
          </div>
          <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto scrollbar-none">
            {nonEmpty.map((t, i) => (
              <button
                key={t.label}
                onClick={() => {
                  setActive(i);
                  scrollerRef.current?.scrollTo({ left: 0 });
                }}
                className={`shrink-0 pb-1 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  i === active
                    ? "border-brand-emerald text-brand-ink"
                    : "border-transparent text-slate-400 hover:text-brand-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </ScrollReveal>
      <div
        key={current.label}
        ref={scrollerRef}
        onScroll={updateProgress}
        className="flex items-stretch gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 px-4 md:px-[max(1.5rem,calc((100%-1600px)/2))] scroll-pl-4 md:scroll-pl-[max(1.5rem,calc((100%-1600px)/2))]"
      >
        {current.products.map((p) => (
          <div key={p.slug} className="shrink-0 snap-start w-[45vw] sm:w-56 md:w-64">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      <div className="container-page mt-6 flex items-center gap-4">
        <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand-emerald transition-[width]"
            style={{ width: `${Math.max(8, progress * 100)}%` }}
          />
        </div>
        <Link
          href="/shop"
          className="hidden sm:flex items-center gap-1 text-sm font-medium text-brand-emerald hover:text-brand-ink transition-colors shrink-0"
        >
          ดูทั้งหมด <ChevronRight size={16} />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => scrollByCard(-1)}
            aria-label="ก่อนหน้า"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 hover:border-brand-emerald transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scrollByCard(1)}
            aria-label="ถัดไป"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 hover:border-brand-emerald transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

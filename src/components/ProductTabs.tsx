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
            <h2 className="text-xl font-bold leading-tight text-brand-ink md:text-[1.75rem]">สินค้าแนะนำ</h2>
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
                aria-pressed={i === active}
                className={`shrink-0 whitespace-nowrap border-b-2 pb-1 text-sm font-semibold transition-colors ${
                  i === active
                    ? "border-brand-action text-brand-ink"
                    : "border-transparent text-slate-500 hover:text-brand-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </ScrollReveal>
      {/* Phones: the row bleeds off the right edge, so a half-visible card
          says "swipe". Tablet and up: the row sits inside the same 1280px
          column as the heading and the arrows below, showing whole cards
          only (3 on tablet, 5 on desktop) — the arrows and progress bar carry
          the "more" cue there instead of a card sliced at the screen edge. */}
      <div className="md:mx-auto md:max-w-[1280px] md:px-6">
        <div
          key={current.label}
          ref={scrollerRef}
          onScroll={updateProgress}
          className="flex items-stretch gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none px-4 pb-1 scroll-pl-4 md:-mx-2 md:-my-2 md:gap-6 md:px-2 md:py-2 md:scroll-pl-2"
        >
          {current.products.map((p) => (
            <div
              key={p.slug}
              className="w-[45vw] shrink-0 snap-start sm:w-56 md:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-6rem)/5)]"
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
      <div className="container-page mt-6 flex items-center gap-4">
        <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand-action transition-[width]"
            style={{ width: `${Math.max(8, progress * 100)}%` }}
          />
        </div>
        <Link
          href="/shop"
          className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-1000"
        >
          ดูทั้งหมด <ChevronRight size={16} />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => scrollByCard(-1)}
            aria-label="ก่อนหน้า"
            className="grid h-9 w-9 place-items-center rounded-full border border-surface-line text-brand-ink transition-colors hover:border-brand-action/40 hover:bg-surface-mist"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scrollByCard(1)}
            aria-label="ถัดไป"
            className="grid h-9 w-9 place-items-center rounded-full border border-surface-line text-brand-ink transition-colors hover:border-brand-action/40 hover:bg-surface-mist"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

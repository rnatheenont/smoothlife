"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { ProductCardData } from "@/data/card";

// A long shelf that arrives a screen at a time.
//
// The brand page's "สินค้าทั้งหมด" tab is the whole catalogue of one brand —
// 25 products for Eucerin and nearly 200 for Smooth E. Drawn all at once that
// is a megabyte of markup and two hundred cards to hydrate, most of it for
// somebody who will look at the first row and press one.
//
// So the cards come in batches as the page is scrolled. Nothing is fetched:
// the whole list is already here as card data (thirteen fields a card, see
// data/card.ts), which is a fraction of the markup those cards would be. The
// batch is what costs — DOM nodes, images, hydration — and it is paid only
// for what somebody actually scrolls to.
//
// The first batch renders on the server like any other shelf, so the top of
// the tab is in the HTML and is what a crawler and a slow phone see first.

/** Four desktop rows (5 across), five tablet rows (4), ten phone rows (2) —
 *  a whole number of rows at every width the grid has. */
const BATCH = 20;

export default function ProductGridScroll({
  items,
  className,
}: {
  items: ProductCardData[];
  /** The grid classes, so the caller keeps deciding how many across. */
  className: string;
}) {
  const [shown, setShown] = useState(BATCH);
  const sentinel = useRef<HTMLDivElement>(null);
  const remaining = items.length - shown;
  const total = items.length;
  const rest = items.slice(BATCH);

  // The observer is the subscription and the callback is where the state
  // changes — the one shape of this that does not cascade a render off an
  // effect body. It re-observes after each batch, so a sentinel still on
  // screen (a short list, or a fast flick to the bottom) fills again until
  // it is not. 400px of margin means the next batch is built while the end
  // of this one is still below the fold, and scrolling never stops at a gap.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown((n) => Math.min(n + BATCH, total));
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, total]);

  return (
    <>
      <div className={className}>
        {items.slice(0, shown).map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>

      {remaining > 0 && (
        <div ref={sentinel} className="mt-6 flex flex-col items-center gap-2">
          {/* A button as well as the observer: scroll-to-load leaves anyone
              on a keyboard, and anyone whose observer never fires, with no
              way to reach the rest. */}
          <button
            type="button"
            onClick={() => setShown((n) => Math.min(n + BATCH, items.length))}
            className="min-h-11 rounded-full border border-surface-line bg-white px-5 text-sm font-bold text-brand-ink transition-colors hover:border-brand-teal hover:text-brand-800"
          >
            ดูสินค้าเพิ่ม
          </button>
          <p aria-live="polite" className="text-xs text-slate-500">
            แสดง {shown} จาก {items.length} รายการ
          </p>
        </div>
      )}

      {/* The products past the first batch, as plain links, for whatever
          reads the HTML rather than scrolling it — a crawler discovering
          URLs, a browser with scripting off. Always the same slice, never
          `shown`: it is the served HTML that matters, and that is rendered
          once with the first batch on screen. Names only, so the whole tail
          of a 200-product brand costs a few tens of kilobytes rather than
          the megabyte the cards would. */}
      {rest.length > 0 && (
        <noscript>
          <ul>
            {rest.map((p) => (
              <li key={p.slug}>
                <Link href={`/product/${p.slug}`}>{p.name}</Link>
              </li>
            ))}
          </ul>
        </noscript>
      )}
    </>
  );
}

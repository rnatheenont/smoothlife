"use client";

import Link from "next/link";
import clsx from "clsx";
import type { ShopSearchParams } from "@/lib/filter-products";

// Sorting, in the open.
//
// It was a <select>: five options behind one tap, and the shopper has to open
// it to find out there is anything in there worth having. Putting the options
// on the page is what SHEIN, Vivino and most large catalogues do, and it
// turns "ขายดี" from a thing you go looking for into a thing you notice.
//
// Links rather than buttons, for the same reason the category circles are:
// a sorted list is a URL worth sharing, and the back button should undo a
// sort the way it undoes everything else.

export const SORTS: { value: string; label: string }[] = [
  { value: "", label: "แนะนำ" },
  { value: "bestseller", label: "ขายดี" },
  { value: "price-asc", label: "ราคาต่ำ–สูง" },
  { value: "price-desc", label: "ราคาสูง–ต่ำ" },
  { value: "rating", label: "คะแนนสูงสุด" },
];

export default function SortChips({ current }: { current: ShopSearchParams }) {
  function hrefFor(value: string) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      // Sorting a list you are 4 pages into should show you the top of the
      // newly sorted list, not page 4 of it.
      if (v && k !== "page" && k !== "sort") params.set(k, v);
    });
    if (value) params.set("sort", value);
    const qs = params.toString();
    return qs ? `/shop?${qs}` : "/shop";
  }

  const active = current.sort ?? "";

  return (
    <div className="flex items-center gap-1 rounded-full bg-surface-soft p-1" role="group" aria-label="เรียงลำดับสินค้า">
      {SORTS.map((s) => {
        const on = active === s.value;
        return (
          <Link
            key={s.value || "featured"}
            href={hrefFor(s.value)}
            scroll={false}
            aria-current={on ? "true" : undefined}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40",
              on ? "bg-white text-brand-800 shadow-xs" : "text-slate-500 hover:text-brand-800"
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}

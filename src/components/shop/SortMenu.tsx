"use client";

import Link from "next/link";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useState } from "react";
import type { ShopSearchParams } from "@/lib/filter-products";
import Dropdown from "@/components/shop/Dropdown";
import { SORTS } from "@/lib/shop-params";

// Sorting, as one control instead of five.
//
// The five options used to sit on the toolbar as chips, which put them in
// front of people who would never have opened a menu to find "ขายดี". What
// it also did was take half the toolbar — and the toolbar now has to hold
// the filters too, which are the controls that narrow 669 products down to
// something a person can read. The sort still says which one is on, so it
// is a menu that answers its own question while closed.
//
// Links, not buttons, for the same reason the chips were: a sorted list is
// a URL worth sharing, and the back button should undo a sort the way it
// undoes everything else.

export default function SortMenu({ current }: { current: ShopSearchParams }) {
  const [open, setOpen] = useState(false);
  const active = current.sort ?? "";
  const activeLabel = SORTS.find((s) => s.value === active)?.label ?? SORTS[0].label;

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

  return (
    <Dropdown
      label={<span className="whitespace-nowrap">เรียงตาม: {activeLabel}</span>}
      open={open}
      align="end"
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
      panelClassName="w-52"
    >
      <div className="flex flex-col gap-0.5">
        {SORTS.map((s) => {
          const on = active === s.value;
          return (
            <Link
              key={s.value || "featured"}
              href={hrefFor(s.value)}
              scroll={false}
              aria-current={on ? "true" : undefined}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                on
                  ? "bg-brand-gradient-soft font-semibold text-brand-800"
                  : "text-slate-600 hover:bg-surface-soft",
              )}
            >
              <span className="flex-1">{s.label}</span>
              {on && <Check size={14} className="shrink-0 text-brand-emerald" />}
            </Link>
          );
        })}
      </div>
    </Dropdown>
  );
}

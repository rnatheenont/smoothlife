"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import { ShopSearchParams } from "@/lib/filter-products";
import { SORTS } from "@/components/shop/SortChips";

export default function SortSelect({ current }: { current: ShopSearchParams }) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    if (e.target.value) params.set("sort", e.target.value);
    else params.delete("sort");
    router.push(`/shop?${params.toString()}`);
  }

  // Kept as a native <select> on purpose: on a phone this opens the OS
  // picker, which is reachable, scrollable with one thumb and already
  // translated. Desktop gets SortChips instead, where there is room to show
  // the five options rather than hide them.
  return (
    <div className="relative">
      <ArrowUpDown
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <select
      defaultValue={current.sort || ""}
      onChange={onChange}
      aria-label="เรียงลำดับสินค้า"
      className="h-10 w-full appearance-none rounded-full border border-slate-200 bg-white pl-9 pr-8 text-center text-sm outline-hidden focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/30 lg:w-auto lg:text-left"
      >
        {SORTS.map((s) => (
          <option key={s.value || "featured"} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

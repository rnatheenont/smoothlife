"use client";

import { useRouter } from "next/navigation";
import { categories } from "@/data/categories";
import { ShopSearchParams } from "@/lib/filter-products";

// Mobile-only category chip row, split out of ShopFilters so callers can
// position it independently of the rest of the filter UI (e.g. above the
// page title instead of below the advisor banner).
export default function CategoryChips({ current }: { current: ShopSearchParams }) {
  const router = useRouter();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <div className="lg:hidden -mx-4 px-4 mb-4 flex gap-2 overflow-x-auto scrollbar-none">
      <button
        onClick={() => updateParam("category", null)}
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          !current.category ? "bg-brand-gradient text-white shadow-xs" : "bg-surface-soft text-slate-600"
        }`}
      >
        ทั้งหมด
      </button>
      {categories.map((c) => (
        <button
          key={c.slug}
          onClick={() => updateParam("category", c.slug)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            current.category === c.slug ? "bg-brand-gradient text-white shadow-xs" : "bg-surface-soft text-slate-600"
          }`}
        >
          {c.nameTh}
        </button>
      ))}
    </div>
  );
}

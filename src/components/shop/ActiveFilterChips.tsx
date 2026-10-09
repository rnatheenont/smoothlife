"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { concerns } from "@/data/categories";
import { brands } from "@/data/brands";
import { multi, PROMO_FILTERS, type ShopSearchParams } from "@/lib/filter-products";

// What is currently narrowing the list, spelled out above it.
//
// Baymard's 2025 mobile benchmark puts this as the single most-missed thing
// in product-list UX — two thirds of sites leave the applied filters inside
// the panel you set them in, so the shopper is looking at 40 results out of
// 600 with nothing on screen saying why. Ours was one of them: the only hint
// was a count that had quietly dropped.
//
// Category is deliberately not here. It has the circle row at the top of the
// page with the active one ringed, and the heading says its name — repeating
// it as a chip would be the third copy of the same fact.

type Chip = { key: string; label: string; remove: Record<string, string | null> };

export default function ActiveFilterChips({ current }: { current: ShopSearchParams }) {
  const router = useRouter();

  function go(changes: Record<string, string | null>) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      // Dropping the page is the point: removing a filter grows the list, and
      // page 7 of the old list is usually past the end of the new one.
      if (v && k !== "page") params.set(k, v);
    });
    for (const [k, v] of Object.entries(changes)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    router.push(qs ? `/shop?${qs}` : "/shop");
  }

  /** One chip per value, so a shopper can drop a single brand out of three. */
  function chipsFor(param: "brand" | "concern" | "promo", labelOf: (slug: string) => string | undefined): Chip[] {
    const values = multi(current[param]);
    return values.flatMap((value) => {
      const label = labelOf(value);
      if (!label) return [];
      const rest = values.filter((v) => v !== value);
      return [{ key: `${param}:${value}`, label, remove: { [param]: rest.join(",") || null } }];
    });
  }

  const chips: Chip[] = [
    ...chipsFor("brand", (slug) => brands.find((b) => b.slug === slug)?.name),
    ...chipsFor("concern", (slug) => concerns.find((c) => c.slug === slug)?.nameTh),
    ...chipsFor("promo", (key) => PROMO_FILTERS.find((f) => f.key === key)?.label),
  ];

  if (current.minPrice || current.maxPrice) {
    const from = current.minPrice ? `฿${Number(current.minPrice).toLocaleString("th-TH")}` : null;
    const to = current.maxPrice ? `฿${Number(current.maxPrice).toLocaleString("th-TH")}` : null;
    chips.push({
      key: "price",
      // "ต่ำกว่า" / "ขึ้นไป" rather than a dash with nothing on one side: a
      // chip reading "฿500 –" asks the reader to work out which end is open.
      label: from && to ? `${from} – ${to}` : from ? `${from} ขึ้นไป` : `ต่ำกว่า ${to}`,
      remove: { minPrice: null, maxPrice: null },
    });
  }
  if (current.rating) {
    chips.push({ key: "rating", label: `${current.rating} ดาวขึ้นไป`, remove: { rating: null } });
  }
  if (current.q) {
    chips.push({ key: "q", label: `ค้นหา "${current.q}"`, remove: { q: null } });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="sr-only">ตัวกรองที่ใช้อยู่</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => go(chip.remove)}
          // The whole chip removes it, not a 12px cross inside it: the cross
          // is the affordance, the chip is the target.
          aria-label={`เอาตัวกรอง ${chip.label} ออก`}
          className="inline-flex h-10 max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-gradient-soft pl-3.5 pr-2.5 text-[13px] font-semibold text-brand-800 transition-colors hover:border-brand-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40"
        >
          <span className="truncate">{chip.label}</span>
          <X size={14} className="shrink-0" aria-hidden="true" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          onClick={() =>
            go({ brand: null, concern: null, promo: null, minPrice: null, maxPrice: null, rating: null, q: null })
          }
          className="inline-flex h-10 items-center rounded-full px-3 text-[13px] font-semibold text-slate-500 underline-offset-2 transition-colors hover:text-brand-800 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40"
        >
          ล้างทั้งหมด
        </button>
      )}
    </div>
  );
}

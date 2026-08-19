"use client";

import { useRouter, usePathname } from "next/navigation";
import { categories, concerns } from "@/data/categories";
import { houseBrands, otherBrands } from "@/data/brands";
import { ShopSearchParams } from "@/lib/filter-products";
import { SlidersHorizontal, Check, X, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import clsx from "clsx";

// Fewer than this and there's nothing to collapse — the toggle would just
// be a "show more" button that reveals one extra row.
const VISIBLE_BRANDS = 10;

export default function ShopFilters({ current, mobileExtra }: { current: ShopSearchParams; mobileExtra?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  // A brand filter reached directly by URL (not by clicking the toggle
  // first) should never be hidden behind a collapsed "show more" — force
  // the full list open whenever the active selection lives past the fold.
  const selectedBrandIndex = current.brand ? otherBrands.findIndex((b) => b.slug === current.brand) : -1;
  const brandsExpanded = showAllBrands || (selectedBrandIndex >= 0 && selectedBrandIndex >= VISIBLE_BRANDS);
  const visibleOtherBrands =
    brandsExpanded || otherBrands.length <= VISIBLE_BRANDS ? otherBrands : otherBrands.slice(0, VISIBLE_BRANDS);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/shop?${params.toString()}`);
  }

  function clearSecondaryFilters() {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page" && k !== "brand" && k !== "concern") params.set(k, v);
    });
    router.push(`/shop?${params.toString()}`);
  }

  const content = (
    <div className="flex flex-col gap-6">
      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">หมวดหมู่</h4>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => updateParam("category", null)}
            className={clsx(
              "rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
              !current.category ? "bg-brand-gradient-soft font-semibold text-brand-emerald" : "text-slate-600 hover:bg-surface-soft"
            )}
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => updateParam("category", c.slug)}
              className={clsx(
                "rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                current.category === c.slug
                  ? "bg-brand-gradient-soft font-semibold text-brand-emerald"
                  : "text-slate-600 hover:bg-surface-soft"
              )}
            >
              {c.nameTh}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">แบรนด์</h4>
        <div className="flex flex-col gap-0.5">
          {houseBrands.map((b) => {
            const selected = current.brand === b.slug;
            return (
              <button
                key={b.slug}
                onClick={() => updateParam("brand", selected ? null : b.slug)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold transition-colors",
                  selected ? "bg-brand-gradient-soft text-brand-emerald" : "text-brand-ink hover:bg-surface-soft"
                )}
              >
                <span
                  className={clsx(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    selected ? "border-brand-emerald bg-brand-emerald" : "border-slate-300"
                  )}
                >
                  {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                {b.name}
              </button>
            );
          })}
          <div className="my-1.5 border-t border-slate-100" />
          <div className="flex flex-col gap-0.5">
            {visibleOtherBrands.map((b) => {
              const selected = current.brand === b.slug;
              return (
                <button
                  key={b.slug}
                  onClick={() => updateParam("brand", selected ? null : b.slug)}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm shrink-0 transition-colors",
                    selected ? "bg-brand-gradient-soft font-semibold text-brand-emerald" : "text-slate-600 hover:bg-surface-soft"
                  )}
                >
                  <span
                    className={clsx(
                      "grid h-4 w-4 shrink-0 place-items-center rounded border-2 transition-colors",
                      selected ? "border-brand-emerald bg-brand-emerald" : "border-slate-300"
                    )}
                  >
                    {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  {b.name}
                </button>
              );
            })}
          </div>
          {otherBrands.length > VISIBLE_BRANDS && (
            <button
              onClick={() => setShowAllBrands((v) => !v)}
              className="mt-1 flex items-center gap-1 px-2 py-1.5 text-left text-xs font-semibold text-brand-emerald hover:text-brand-sky transition-colors"
            >
              <ChevronDown size={13} className={clsx("transition-transform", brandsExpanded && "rotate-180")} />
              {brandsExpanded ? "แสดงน้อยลง" : `แสดงเพิ่มเติม (${otherBrands.length - VISIBLE_BRANDS})`}
            </button>
          )}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">ปัญหาผิวที่กังวล</h4>
        <div className="flex flex-col gap-0.5">
          {concerns.map((c) => (
            <button
              key={c.slug}
              onClick={() => updateParam("concern", current.concern === c.slug ? null : c.slug)}
              className={clsx(
                "rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                current.concern === c.slug
                  ? "bg-brand-gradient-soft font-semibold text-brand-emerald"
                  : "text-slate-600 hover:bg-surface-soft"
              )}
            >
              {c.nameTh}
            </button>
          ))}
        </div>
      </div>
      {(current.category || current.brand || current.concern) && (
        <button onClick={() => router.push(pathname)} className="text-xs text-rose-500 font-medium text-left">
          ล้างตัวกรองทั้งหมด
        </button>
      )}
    </div>
  );

  // Mobile filter sheet: category now lives in its own always-visible chip
  // row on the page (rendered directly below, before the sheet trigger), so
  // this sheet only holds the secondary filters — brand and concern.
  const activeSecondaryCount = Number(Boolean(current.brand)) + Number(Boolean(current.concern));

  const mobileContent = (
    <div className="flex flex-col gap-7">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">แบรนด์ในเครือ · Life So Smooth</h4>
        <div className="flex flex-col rounded-xl border border-brand-emerald/30 mb-4">
          {houseBrands.map((b) => {
            const selected = current.brand === b.slug;
            return (
              <button
                key={b.slug}
                onClick={() => updateParam("brand", selected ? null : b.slug)}
                className={`flex items-center justify-between px-3.5 py-3 text-sm text-left font-bold border-b border-slate-50 last:border-0 ${
                  selected ? "text-brand-emerald bg-brand-gradient-soft" : "text-brand-ink"
                }`}
              >
                {b.name}
                {selected && <Check size={16} className="text-brand-emerald shrink-0" />}
              </button>
            );
          })}
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">แบรนด์อื่นๆ</h4>
        <div className="flex flex-col rounded-xl border border-slate-100">
          {otherBrands.map((b) => {
            const selected = current.brand === b.slug;
            return (
              <button
                key={b.slug}
                onClick={() => updateParam("brand", selected ? null : b.slug)}
                className={`flex items-center justify-between px-3.5 py-3 text-sm text-left border-b border-slate-50 last:border-0 ${
                  selected ? "font-semibold text-brand-emerald bg-brand-gradient-soft" : "text-slate-600"
                }`}
              >
                {b.name}
                {selected && <Check size={16} className="text-brand-emerald shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">ปัญหาผิวที่กังวล</h4>
        <div className="flex flex-wrap gap-2">
          {concerns.map((c) => (
            <button
              key={c.slug}
              onClick={() => updateParam("concern", current.concern === c.slug ? null : c.slug)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                current.concern === c.slug ? "bg-brand-gradient text-white" : "bg-surface-soft text-slate-600"
              }`}
            >
              {c.nameTh}
            </button>
          ))}
        </div>
      </div>
      {activeSecondaryCount > 0 && (
        <button
          onClick={clearSecondaryFilters}
          className="rounded-full border border-rose-200 text-rose-500 font-semibold text-sm py-2.5"
        >
          ล้างตัวกรองแบรนด์และปัญหาผิว
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="lg:hidden -mx-4 px-4 mb-3 flex gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => updateParam("category", null)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            !current.category ? "bg-brand-gradient text-white shadow-sm" : "bg-surface-soft text-slate-600"
          }`}
        >
          ทั้งหมด
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            onClick={() => updateParam("category", c.slug)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              current.category === c.slug ? "bg-brand-gradient text-white shadow-sm" : "bg-surface-soft text-slate-600"
            }`}
          >
            {c.nameTh}
          </button>
        ))}
      </div>
      <div className="lg:hidden flex items-center gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => setMobileOpen(true)}
            className="relative h-10 w-full flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium active:scale-95 transition-transform"
          >
            <SlidersHorizontal size={15} /> ตัวกรอง
            {activeSecondaryCount > 0 && (
              <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">
                {activeSecondaryCount}
              </span>
            )}
          </button>
        </div>
        <div className="min-w-0 flex-1">{mobileExtra}</div>
      </div>
      <aside className="hidden lg:block lg:sticky lg:top-[152px] lg:self-start w-56 shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-2xl bg-white shadow-xl animate-slideUp">
            <div className="flex items-center justify-center pt-2.5 pb-1 shrink-0">
              <span className="h-1.5 w-10 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 shrink-0">
              <h3 className="font-bold">ตัวกรองสินค้า</h3>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="ปิด"
                className="grid h-8 w-8 place-items-center rounded-full bg-surface-soft text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">{mobileContent}</div>
            <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shrink-0">
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm shadow-card"
              >
                ดูสินค้า
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

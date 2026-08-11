"use client";

import { useRouter, usePathname } from "next/navigation";
import { categories, concerns } from "@/data/categories";
import { brands } from "@/data/brands";
import { ShopSearchParams } from "@/lib/filter-products";
import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

export default function ShopFilters({ current, mobileExtra }: { current: ShopSearchParams; mobileExtra?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/shop?${params.toString()}`);
  }

  const content = (
    <div className="flex flex-col gap-6">
      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">หมวดหมู่</h4>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => updateParam("category", null)}
            className={`text-left text-sm py-1 ${!current.category ? "font-semibold text-brand-emerald" : "text-slate-600"}`}
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => updateParam("category", c.slug)}
              className={`text-left text-sm py-1 ${current.category === c.slug ? "font-semibold text-brand-emerald" : "text-slate-600"}`}
            >
              {c.nameTh}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">แบรนด์</h4>
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
          {brands.map((b) => (
            <button
              key={b.slug}
              onClick={() => updateParam("brand", current.brand === b.slug ? null : b.slug)}
              className={`text-left text-sm py-1 ${current.brand === b.slug ? "font-semibold text-brand-emerald" : "text-slate-600"}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">ปัญหาผิวที่กังวล</h4>
        <div className="flex flex-col gap-1.5">
          {concerns.map((c) => (
            <button
              key={c.slug}
              onClick={() => updateParam("concern", current.concern === c.slug ? null : c.slug)}
              className={`text-left text-sm py-1 ${current.concern === c.slug ? "font-semibold text-brand-emerald" : "text-slate-600"}`}
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

  return (
    <>
      <div className="lg:hidden flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium"
        >
          <SlidersHorizontal size={15} /> ตัวกรอง
        </button>
        {mobileExtra}
      </div>
      <aside className="hidden lg:block w-56 shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white p-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">ตัวกรองสินค้า</h3>
              <button onClick={() => setMobileOpen(false)} className="text-sm text-slate-500">ปิด</button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  );
}

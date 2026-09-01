"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Repeat, Search, PackagePlus, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { categories } from "@/data/categories";

type ProductRow = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  inStock: boolean;
  subscribable: boolean;
  bundleEligible: boolean;
};

type StatusFilter = "all" | "subscribable-off" | "bundle-on";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "subscribable-off", label: "ปิดสมัครรับประจำ" },
  { value: "bundle-on", label: "เปิดจัดชุดเอง" },
];

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-brand-emerald" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminSubscriptionProductsPage() {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Debounce free-text search so typing doesn't need an explicit submit —
  // category/status/page changes still refetch immediately below.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQuery(queryInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  async function load() {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams({ page: String(page), status });
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      const res = await fetch(`/api/admin/subscription-products?${params}`);
      const data = await res.json();
      if (data.ok) {
        setRows(data.products);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, status, page]);

  async function toggle(slug: string, field: "subscribable" | "bundleEligible", value: boolean) {
    setBusySlug(slug);
    try {
      const res = await fetch("/api/admin/subscription-products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug: slug, [field]: value }),
      });
      const data = await res.json();
      if (data.ok) {
        setRows((prev) => prev.map((r) => (r.slug === slug ? { ...r, [field]: value } : r)));
      }
    } finally {
      setBusySlug(null);
    }
  }

  async function bulkToggle(field: "subscribable" | "bundleEligible", value: boolean) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/subscription-products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlugs: Array.from(selected), [field]: value }),
      });
      const data = await res.json();
      if (data.ok) {
        setRows((prev) => prev.map((r) => (selected.has(r.slug) ? { ...r, [field]: value } : r)));
      }
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.slug))));
  }

  function toggleSelectOne(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2">
          <Repeat size={20} className="text-brand-emerald" /> สินค้าที่สมัครสมาชิกได้
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          เปิด/ปิดว่าสินค้าไหนสมัครรับประจำได้ (สมัครรับประจำ) และเอาไปจัดชุดเองได้ไหม (จัดชุดสินค้าเอง) — เลือกได้หลายรายการเพื่อเปิด/ปิดพร้อมกัน
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="ค้นหาสินค้า, ยี่ห้อ..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-teal bg-white"
        >
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameTh}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setPage(1);
              setStatus(f.value);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              status === f.value ? "bg-brand-gradient text-white" : "bg-surface-soft text-slate-500 hover:text-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft px-4 py-3 text-sm">
          <span className="font-semibold text-brand-ink">เลือกแล้ว {selected.size} รายการ</span>
          {bulkBusy && <Loader2 size={14} className="animate-spin text-brand-emerald" />}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
              <Repeat size={12} /> สมัครรับประจำ
            </span>
            <button
              disabled={bulkBusy}
              onClick={() => bulkToggle("subscribable", true)}
              className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-semibold text-brand-emerald disabled:opacity-50"
            >
              เปิด
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => bulkToggle("subscribable", false)}
              className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 disabled:opacity-50"
            >
              ปิด
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
              <PackagePlus size={12} /> จัดชุดเอง
            </span>
            <button
              disabled={bulkBusy}
              onClick={() => bulkToggle("bundleEligible", true)}
              className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-semibold text-brand-emerald disabled:opacity-50"
            >
              เปิด
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => bulkToggle("bundleEligible", false)}
              className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 disabled:opacity-50"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">ไม่พบสินค้าที่ตรงเงื่อนไข</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-2 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === rows.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="py-2 pr-4 font-medium">สินค้า</th>
                  <th className="py-2 pr-4 font-medium text-center">
                    <span className="flex items-center gap-1 justify-center">
                      <Repeat size={13} /> สมัครรับประจำ
                    </span>
                  </th>
                  <th className="py-2 pr-4 font-medium text-center">
                    <span className="flex items-center gap-1 justify-center">
                      <PackagePlus size={13} /> จัดชุดเอง
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.slug} className="border-b border-slate-50">
                    <td className="py-2.5 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.slug)}
                        onChange={() => toggleSelectOne(r.slug)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                          <Image src={r.image} alt="" fill sizes="40px" className="object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-brand-ink line-clamp-1">{r.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {r.brand}
                            {!r.inStock && " · สินค้าหมด"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      <div className="flex justify-center">
                        <Toggle
                          on={r.subscribable}
                          disabled={busySlug === r.slug}
                          onClick={() => toggle(r.slug, "subscribable", !r.subscribable)}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      <div className="flex justify-center">
                        <Toggle
                          on={r.bundleEligible}
                          disabled={busySlug === r.slug}
                          onClick={() => toggle(r.slug, "bundleEligible", !r.bundleEligible)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
            <span>ทั้งหมด {total.toLocaleString()} รายการ</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                หน้า {page} จาก {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

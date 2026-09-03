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

type StatusFilter = "all" | "subscribable-on" | "subscribable-off" | "bundle-on" | "bundle-off";

// Both polarities of both switches. The old set offered "ปิดสมัครรับประจำ" and
// "เปิดจัดชุดเอง" — opposite polarities of different switches, and no way at
// all to answer "which products ARE open for subscription?", which is the
// first thing anyone opens this page to find out.
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "subscribable-on", label: "เปิดสมัครรับประจำ" },
  { value: "subscribable-off", label: "ปิดสมัครรับประจำ" },
  { value: "bundle-on", label: "เปิดจัดชุดเอง" },
  { value: "bundle-off", label: "ปิดจัดชุดเอง" },
];

// Purely visual — the actual tap target is ToggleRow/ToggleCell below. A
// bare 24px-tall switch is under Apple/Material's ~44px minimum touch
// target, so real-device taps that land a few px off it silently do
// nothing (reported as the button "still being broken" even though
// clicks on the exact pixel — e.g. automated testing — always worked).
//
// The word is not decoration. On a page where almost everything is off, a
// column of grey switches reads as a column of empty circles — you cannot
// tell "off" from "not loaded yet", and there is nothing to compare a single
// green one against. Saying เปิด/ปิด removes the guess entirely.
function ToggleIndicator({ on }: { on: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-brand-emerald" : "bg-slate-200"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className={`w-6 text-[11px] font-semibold ${on ? "text-brand-emerald" : "text-slate-400"}`}>
        {on ? "เปิด" : "ปิด"}
      </span>
    </span>
  );
}

// Mobile card rows: the whole row is the tap target, not just the switch.
function ToggleRow({
  icon,
  label,
  on,
  onClick,
  disabled,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  onClick: () => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-3 py-1.5 text-left disabled:opacity-50 ${className}`}
    >
      <span className="flex items-center gap-1 text-xs text-slate-500">
        {icon} {label}
      </span>
      <ToggleIndicator on={on} />
    </button>
  );
}

// Desktop table cells: enlarge the tap/click box past the visual switch
// via padding + a matching negative margin, so it doesn't affect layout.
function ToggleCell({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="block p-2.5 -m-2.5 disabled:opacity-50">
      <ToggleIndicator on={on} />
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
  const [counts, setCounts] = useState({ total: 0, subscribableOn: 0, bundleOn: 0 });
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
        setCounts(data.counts ?? { total: 0, subscribableOn: 0, bundleOn: 0 });
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
        // Keep the summary honest without refetching — a counter that only
        // updates on reload is worse than no counter.
        setCounts((c) => {
          const key = field === "subscribable" ? "subscribableOn" : "bundleOn";
          return { ...c, [key]: Math.max(0, c[key] + (value ? 1 : -1)) };
        });
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
        const changed = rows.filter((r) => selected.has(r.slug) && r[field] !== value).length;
        setRows((prev) => prev.map((r) => (selected.has(r.slug) ? { ...r, [field]: value } : r)));
        setCounts((c) => {
          const key = field === "subscribable" ? "subscribableOn" : "bundleOn";
          return { ...c, [key]: Math.max(0, c[key] + (value ? changed : -changed)) };
        });
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
          กำหนดว่าสินค้าไหนลูกค้าสมัครรับประจำได้ และสินค้าไหนเอาไปจัดชุดเองได้ — ติ๊กหลายรายการเพื่อเปิด/ปิดพร้อมกันได้
        </p>
      </div>

      {/* The first question anyone opens this page with is "how many are on?"
          — a list of 900 switches cannot answer it, and scrolling to count is
          not an answer either. */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl2 border border-slate-100 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Repeat size={13} className="text-brand-emerald" /> สมัครรับประจำ
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            <span className="text-xl font-bold text-brand-ink">{counts.subscribableOn.toLocaleString()}</span>
            {" / "}
            {counts.total.toLocaleString()} รายการ
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">ลูกค้าเลือกสมัครรับสินค้านี้ทุกเดือนได้</p>
        </div>
        <div className="rounded-xl2 border border-slate-100 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <PackagePlus size={13} className="text-brand-emerald" /> จัดชุดเอง
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            <span className="text-xl font-bold text-brand-ink">{counts.bundleOn.toLocaleString()}</span>
            {" / "}
            {counts.total.toLocaleString()} รายการ
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">ลูกค้าหยิบสินค้านี้ใส่ชุดสมาชิกที่จัดเองได้</p>
        </div>
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
          <div className="flex items-center gap-1.5 sm:ml-auto">
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
          {/* Mobile: stacked cards — a table forced the two toggle columns
              off-screen to the right with no scroll affordance, so on a
              phone the switches were unreachable without knowing to swipe
              (reported as "the on/off button is broken"). Toggles sit full
              width below each product here instead, always visible. */}
          <div className="flex flex-col gap-2 md:hidden">
            <label className="flex items-center gap-2 text-xs text-slate-500 px-1">
              <input
                type="checkbox"
                checked={selected.size === rows.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300"
              />
              เลือกทั้งหมดในหน้านี้
            </label>
            {rows.map((r) => (
              <div key={r.slug} className="rounded-xl2 border border-slate-100 p-3 shadow-card">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(r.slug)}
                    onChange={() => toggleSelectOne(r.slug)}
                    className="h-4 w-4 rounded border-slate-300 shrink-0"
                  />
                  <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                    <Image src={r.image} alt="" fill sizes="40px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-brand-ink line-clamp-2">{r.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {r.brand}
                      {!r.inStock && " · สินค้าหมด"}
                    </p>
                  </div>
                </div>
                <ToggleRow
                  icon={<Repeat size={13} />}
                  label="สมัครรับประจำ"
                  on={r.subscribable}
                  disabled={busySlug === r.slug}
                  onClick={() => toggle(r.slug, "subscribable", !r.subscribable)}
                  className="mt-2 pt-3 border-t border-slate-50"
                />
                <ToggleRow
                  icon={<PackagePlus size={13} />}
                  label="จัดชุดเอง"
                  on={r.bundleEligible}
                  disabled={busySlug === r.slug}
                  onClick={() => toggle(r.slug, "bundleEligible", !r.bundleEligible)}
                />
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
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
                  <th className="py-2 pr-4 font-medium text-center w-40">
                    <span className="flex items-center gap-1 justify-center text-slate-500">
                      <Repeat size={13} /> สมัครรับประจำ
                    </span>
                  </th>
                  <th className="py-2 pr-4 font-medium text-center w-40">
                    <span className="flex items-center gap-1 justify-center text-slate-500">
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
                          {/* Two lines, not one: these names run long and share a prefix
                              ("[1 Free 1] Smooth E 24k Glow Booster…"), so a single
                              clipped line makes different products look identical. */}
                          <p className="text-xs font-semibold text-brand-ink line-clamp-2">{r.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {r.brand}
                            {!r.inStock && " · สินค้าหมด"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      <div className="flex justify-center">
                        <ToggleCell
                          on={r.subscribable}
                          disabled={busySlug === r.slug}
                          onClick={() => toggle(r.slug, "subscribable", !r.subscribable)}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      <div className="flex justify-center">
                        <ToggleCell
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

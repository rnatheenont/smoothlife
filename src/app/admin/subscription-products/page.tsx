"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Repeat, Search, PackagePlus, Loader2, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
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

type Field = "subscribable" | "bundleEligible";

// The catalogue is ~900 products and the actual job is "turn on the handful we
// want to sell as a subscription". Paging through all of it to find them was
// the whole problem: 30 pages of switches, with the few already on scattered
// across them.
//
// So the default view is the curated set — only what's on, usually short — and
// adding to it is a search rather than a hunt. Browsing everything is still
// possible by searching; it just isn't what the screen opens with.
//
// One tab per setting, too. Two switch columns meant reading every row twice
// and travelling to the far right of the table for both answers.
const TABS: { key: Field; label: string; icon: typeof Repeat; blurb: string }[] = [
  {
    key: "subscribable",
    label: "สมัครรับประจำ",
    icon: Repeat,
    blurb: "ลูกค้าเลือกสมัครรับสินค้านี้ทุกเดือนได้",
  },
  {
    key: "bundleEligible",
    label: "จัดชุดเอง",
    icon: PackagePlus,
    blurb: "ลูกค้าหยิบสินค้านี้ใส่ชุดสมาชิกที่จัดเองได้",
  },
];

function ProductLine({ row }: { row: ProductRow }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-soft">
        <Image src={row.image} alt="" fill sizes="40px" className="object-cover" />
      </div>
      <div className="min-w-0">
        {/* Two lines: these names share a long prefix ("[1 Free 1] Smooth E 24k
            Glow Booster…"), so one clipped line makes different products look
            identical. */}
        <p className="line-clamp-2 text-xs font-semibold text-brand-ink">{row.name}</p>
        <p className="text-[11px] text-slate-400">
          {row.brand}
          {!row.inStock && " · สินค้าหมด"}
        </p>
      </div>
    </div>
  );
}

export default function AdminSubscriptionProductsPage() {
  const [tab, setTab] = useState<Field>("subscribable");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ total: 0, subscribableOn: 0, bundleOn: 0 });
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const searching = query.length > 0;
  const active = TABS.find((t) => t.key === tab)!;

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQuery(queryInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Searching looks across the whole catalogue — that is the point of
      // searching. Not searching shows only what is already on for this tab.
      const status = searching ? "all" : tab === "subscribable" ? "subscribable-on" : "bundle-on";
      const params = new URLSearchParams({ page: String(page), status });
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      const res = await fetch(`/api/admin/subscription-products?${params}`);
      const data = await res.json();
      if (data.ok) {
        setRows(data.products);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setCounts(data.counts ?? { total: 0, subscribableOn: 0, bundleOn: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [query, category, page, tab, searching]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(slug: string, field: Field, value: boolean) {
    setBusySlug(slug);
    try {
      const res = await fetch("/api/admin/subscription-products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug: slug, [field]: value }),
      });
      const data = await res.json();
      if (!data.ok) return;

      setCounts((c) => {
        const key = field === "subscribable" ? "subscribableOn" : "bundleOn";
        return { ...c, [key]: Math.max(0, c[key] + (value ? 1 : -1)) };
      });

      // Removing something while looking at the "what's on" list should take it
      // out of that list. Leaving a switched-off row sitting in a list defined
      // as "things that are on" is how a screen stops being believable.
      if (!searching && !value && field === tab) {
        setRows((prev) => prev.filter((r) => r.slug !== slug));
        setTotal((t) => Math.max(0, t - 1));
        return;
      }
      setRows((prev) => prev.map((r) => (r.slug === slug ? { ...r, [field]: value } : r)));
    } finally {
      setBusySlug(null);
    }
  }

  const onCount = tab === "subscribable" ? counts.subscribableOn : counts.bundleOn;

  return (
    <div>
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <Repeat size={20} className="text-brand-emerald" /> สินค้าที่สมัครสมาชิกได้
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          เลือกว่าสินค้าไหนให้ลูกค้าสมัครรับประจำได้ และสินค้าไหนเอาไปจัดชุดเองได้
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const n = t.key === "subscribable" ? counts.subscribableOn : counts.bundleOn;
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key ? "bg-brand-gradient text-white" : "bg-surface-soft text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={14} />
              {t.label}
              <span
                className={`rounded-full px-1.5 text-[11px] ${tab === t.key ? "bg-white/25" : "bg-white text-slate-400"}`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mb-3 text-xs text-slate-400">{active.blurb}</p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="พิมพ์ชื่อสินค้าหรือยี่ห้อ เพื่อเพิ่มเข้าลิสต์..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm outline-none focus:border-brand-teal"
          />
          {queryInput && (
            <button
              onClick={() => setQueryInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="ล้างการค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {/* Only useful while browsing search results — filtering a list of five
            things you already curated is noise. */}
        {searching && (
          <select
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-teal"
          >
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nameTh}
              </option>
            ))}
          </select>
        )}
      </div>

      {searching ? (
        <p className="mb-2 text-xs text-slate-500">
          ผลการค้นหา {total.toLocaleString()} รายการ — กด{" "}
          <span className="font-semibold text-brand-emerald">เพิ่ม</span> เพื่อเปิด &ldquo;{active.label}&rdquo;
        </p>
      ) : (
        <p className="mb-2 text-xs text-slate-500">
          เปิด &ldquo;{active.label}&rdquo; อยู่ {onCount.toLocaleString()} รายการ
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-slate-200 py-10 text-center">
          {searching ? (
            <p className="text-sm text-slate-400">ไม่พบสินค้าที่ตรงกับคำค้นหา</p>
          ) : (
            <>
              <p className="text-sm text-slate-500">ยังไม่ได้เปิด &ldquo;{active.label}&rdquo; ให้สินค้าไหนเลย</p>
              <p className="mt-1 text-xs text-slate-400">พิมพ์ค้นหาด้านบนเพื่อเพิ่มสินค้าเข้าลิสต์</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const on = tab === "subscribable" ? r.subscribable : r.bundleEligible;
            const other = tab === "subscribable" ? r.bundleEligible : r.subscribable;
            const otherLabel = tab === "subscribable" ? "จัดชุดเอง" : "สมัครรับประจำ";
            return (
              <div key={r.slug} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                <ProductLine row={r} />

                {/* Shown rather than hidden behind the other tab: switching tabs
                    to check would mean losing your place in this list. */}
                {other && (
                  <span className="hidden shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] text-slate-400 sm:block">
                    {otherLabel} เปิดอยู่
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => toggle(r.slug, tab, !on)}
                  disabled={busySlug === r.slug}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    on
                      ? "border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-500"
                      : "bg-brand-gradient text-white"
                  }`}
                >
                  {busySlug === r.slug ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : on ? (
                    <X size={13} />
                  ) : (
                    <Plus size={13} />
                  )}
                  {on ? "เอาออก" : "เพิ่ม"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
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
      )}
    </div>
  );
}

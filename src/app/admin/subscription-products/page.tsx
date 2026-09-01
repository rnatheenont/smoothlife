"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Repeat, Search, PackagePlus } from "lucide-react";

type ProductRow = {
  slug: string;
  name: string;
  brand: string;
  image: string;
  inStock: boolean;
  subscribable: boolean;
  bundleEligible: boolean;
};

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
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  async function load(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscription-products${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const data = await res.json();
      setRows(data.ok ? data.products : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2">
          <Repeat size={20} className="text-brand-emerald" /> สินค้าที่สมัครสมาชิกได้
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          เปิด/ปิดว่าสินค้าไหนสมัครรับประจำได้ (สมัครรับประจำ) และเปิด/ปิดว่าเอาไปจัดชุดเอง (จัดชุดสินค้าเอง) ได้ไหม
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(query);
        }}
        className="flex gap-2 mb-5"
      >
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาสินค้า, ยี่ห้อ..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand-gradient text-white text-sm font-semibold px-4">
          ค้นหา
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">
          {query ? "ไม่พบสินค้าที่ค้นหา" : "ยังไม่มีสินค้าที่ตั้งค่าไว้ — ลองค้นหาเพื่อเริ่มตั้งค่า"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
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
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                        <Image src={r.image} alt="" fill sizes="40px" className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-brand-ink line-clamp-1">{r.name}</p>
                        <p className="text-[11px] text-slate-400">{r.brand}{!r.inStock && " · สินค้าหมด"}</p>
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
      )}
    </div>
  );
}

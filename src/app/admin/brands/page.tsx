"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Award, Search } from "lucide-react";

import { PageHeader } from "@/components/admin/layout-kit";
import { Card } from "@/components/ui";

// Every brand the shop sells, and how far its page has been dressed.
//
// Every brand already has a page — the automatic one, built from the
// catalogue. This screen is for the ones worth more than that: a picture at
// the top, a paragraph on who they are, the products to lead with. House
// brands are listed first because they are the ones the team will dress.

type BrandRow = {
  slug: string;
  name: string;
  logo: string;
  isHouse: boolean;
  productCount: number;
  profile: { hasHero: boolean; hasStory: boolean; uspCount: number; featuredCount: number; updatedAt: string } | null;
  layout: "auto" | "custom" | "custom-draft";
};

const LAYOUT_LABEL: Record<BrandRow["layout"], string> = {
  auto: "หน้าอัตโนมัติ",
  custom: "จัดหน้าเอง (เผยแพร่แล้ว)",
  "custom-draft": "จัดหน้าเอง (ยังเป็นร่าง)",
};

function filled(row: BrandRow): string {
  const p = row.profile;
  if (!p) return "ยังไม่มีโปรไฟล์";
  const parts = [
    p.hasHero && "รูปหัว",
    p.hasStory && "เรื่องราว",
    p.uspCount > 0 && `จุดเด่น ${p.uspCount}`,
    p.featuredCount > 0 && `สินค้าแนะนำ ${p.featuredCount}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "โปรไฟล์ว่าง";
}

export default function AdminBrandsPage() {
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [liveOnSite, setLiveOnSite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/brands");
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error ?? "โหลดรายชื่อแบรนด์ไม่สำเร็จ");
        setRows(data.brands);
        setLiveOnSite(Boolean(data.liveOnSite));
      } catch (err) {
        setError(err instanceof Error ? err.message : "โหลดรายชื่อแบรนด์ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q)) : rows;
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={<Award size={20} />}
        title="หน้าแบรนด์"
        subtitle="ทุกแบรนด์มีหน้าอัตโนมัติอยู่แล้ว · เติมรูปหัว เรื่องราว จุดเด่น และสินค้าแนะนำ ให้หน้าของแบรนด์ที่สำคัญ"
      />

      {!liveOnSite && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          หน้าแบรนด์บนเว็บจริงยังใช้แบบเดิมอยู่ — บันทึกโปรไฟล์ไว้ได้เลย จะขึ้นบนเว็บเมื่อทีมเปิดใช้ระบบหน้าแบรนด์ใหม่
        </p>
      )}

      <label className="relative block max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาแบรนด์"
          aria-label="ค้นหาแบรนด์"
          className="h-11 w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 text-sm outline-hidden focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/30"
        />
      </label>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Card padded={false}>
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">กำลังโหลด…</p>
        ) : shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">ไม่พบแบรนด์ที่ค้นหา</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((row) => (
              <li key={row.slug}>
                <Link
                  href={`/admin/brands/${row.slug}`}
                  className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-soft"
                >
                  <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-white">
                    {row.logo && <Image src={row.logo} alt="" fill sizes="64px" className="object-contain p-1" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-brand-ink" translate="no">
                        {row.name}
                      </span>
                      {row.isHouse && (
                        <span className="shrink-0 rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-bold text-white">
                          แบรนด์ในเครือ
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[12px] text-slate-500">
                      {row.productCount} สินค้าพร้อมขาย · {filled(row)}
                    </span>
                  </span>
                  <span
                    className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-block ${
                      row.layout === "custom" ? "bg-brand-50 text-brand-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {LAYOUT_LABEL[row.layout]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

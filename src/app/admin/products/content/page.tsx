"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, FileEdit, CheckCircle2, Circle } from "lucide-react";
import { PageHeader, adminTable } from "@/components/admin/layout-kit";
import { products } from "@/data/products";
import { stableContentVariantId } from "@/lib/product-content";

// Every product, searchable by SKU first (what the team actually recognises
// — see the comment on ProductVariant.sku) or by name, with how far each
// one's free-form content has gotten. The edit screen is a separate page
// (./[variantId]) — this one is just "find it, see its status, go".

type Status = "published" | "draft" | "none";

type OverrideRow = { variant_id: string; sku: string | null; published: boolean; blocks: unknown[] };

const STATUS_LABEL: Record<Status, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  published: { label: "เผยแพร่แล้ว", className: "text-emerald-700 bg-emerald-50", icon: CheckCircle2 },
  draft: { label: "ร่าง", className: "text-amber-700 bg-amber-50", icon: FileEdit },
  none: { label: "ยังไม่มีเนื้อหา", className: "text-slate-400 bg-slate-50", icon: Circle },
};

export default function ProductContentListPage() {
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");

  useEffect(() => {
    fetch("/api/admin/product-content")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, OverrideRow> = {};
        for (const row of d?.overrides ?? []) map[row.variant_id] = row;
        setOverrides(map);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const rows = useMemo(
    () =>
      products.map((p) => {
        // Content is pinned to a fixed variant (see stableContentVariantId),
        // not p.variantId — that field is recomputed as the cheapest in-stock
        // variant on every build and would silently detach written content
        // from its row the day a price or stock level changes.
        const contentVariantId = stableContentVariantId(p);
        const sku = p.variants.find((v) => v.variantId === contentVariantId)?.sku ?? null;
        const override = overrides[contentVariantId];
        const status: Status = !override ? "none" : override.published ? "published" : "draft";
        return { product: p, contentVariantId, sku, status };
      }),
    [overrides]
  );

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (!q) return true;
    return r.product.name.toLowerCase().includes(q) || (r.sku ?? "").toLowerCase().includes(q);
  });
  const shown = filtered.slice(0, 200);

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { published: 0, draft: 0, none: 0 } as Record<Status, number>
  );

  return (
    <div>
      <PageHeader
        title="เนื้อหาสินค้า"
        subtitle="รายละเอียดสินค้าแบบอิสระ 2 ภาษา — ค้นด้วย SKU หรือชื่อสินค้า"
      />

      <div className="mt-5 flex items-center gap-3">
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand-gradient"
            style={{ width: `${rows.length > 0 ? Math.round((counts.published / rows.length) * 100) : 0}%` }}
          />
        </div>
        <span className="text-xs text-slate-500">
          เผยแพร่แล้ว {counts.published.toLocaleString("th-TH")} · ร่าง {counts.draft.toLocaleString("th-TH")} ·
          ยังไม่มีเนื้อหา {counts.none.toLocaleString("th-TH")} (จากทั้งหมด {rows.length.toLocaleString("th-TH")})
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหา SKU หรือชื่อสินค้า…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-hidden focus:border-brand-teal"
          />
        </div>
        <div className="inline-flex rounded-full bg-surface-muted p-1 text-xs">
          {(
            [
              ["all", `ทั้งหมด ${rows.length.toLocaleString("th-TH")}`],
              ["none", `ยังไม่มีเนื้อหา ${counts.none.toLocaleString("th-TH")}`],
              ["draft", `ร่าง ${counts.draft.toLocaleString("th-TH")}`],
              ["published", `เผยแพร่แล้ว ${counts.published.toLocaleString("th-TH")}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={
                filter === key
                  ? "rounded-full bg-white px-3 py-1.5 font-semibold text-brand-ink shadow-card"
                  : "rounded-full px-3 py-1.5 font-medium text-slate-500 hover:text-brand-ink"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`mt-4 rounded-xl2 bg-white ring-1 ring-surface-line ${adminTable.scroll}`}>
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th>สินค้า</th>
              <th>SKU</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ product: p, contentVariantId, sku, status }) => {
              const St = STATUS_LABEL[status];
              return (
                <tr key={contentVariantId} className={adminTable.row}>
                  <td className={adminTable.cell}>
                    <Link
                      href={`/admin/products/content/${encodeURIComponent(contentVariantId)}`}
                      className="flex items-center gap-2.5 hover:text-brand-800"
                    >
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface-soft ring-1 ring-surface-line">
                        {p.image && <Image src={p.image} alt="" fill sizes="36px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 truncate font-medium text-brand-ink">{p.name}</span>
                    </Link>
                  </td>
                  <td className={adminTable.mono}>{sku ?? "—"}</td>
                  <td className={adminTable.cell}>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${St.className}`}>
                      <St.icon size={12} aria-hidden="true" />
                      {St.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {loaded && shown.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-slate-400">
                  ไม่พบรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > shown.length && (
        <p className="mt-2 text-xs text-slate-400">
          แสดง {shown.length} จาก {filtered.length.toLocaleString("th-TH")} รายการ — พิมพ์ค้นหาเพื่อแคบลง
        </p>
      )}
    </div>
  );
}

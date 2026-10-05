"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, FileEdit, CheckCircle2, Circle } from "lucide-react";
import {
  PageHeader,
  adminTable,
} from "@/components/admin/layout-kit";
import { products } from "@/data/products";
import { stableContentVariantId } from "@/lib/product-content";
import AdminSelect from "@/components/admin/AdminSelect";

// Every product, searchable by SKU first (what the team actually recognises
// — see the comment on ProductVariant.sku) or by name, with how far each
// one's free-form content has gotten. The edit screen is a separate page
// (./[variantId]) — this one is just "find it, see its status, go".

type Status = "published" | "draft" | "none";

type OverrideRow = {
  variant_id: string;
  sku: string | null;
  published: boolean;
  blocks: unknown[];
};

const STATUS_LABEL: Record<
  Status,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  published: {
    label: "เผยแพร่แล้ว",
    className: "text-emerald-700 bg-emerald-50",
    icon: CheckCircle2,
  },
  draft: {
    label: "ร่าง",
    className: "text-amber-700 bg-amber-50",
    icon: FileEdit,
  },
  none: {
    label: "ยังไม่มีเนื้อหา",
    className: "text-slate-400 bg-slate-50",
    icon: Circle,
  },
};

type ImageStatus = { useCustom: boolean; count: number; videoCount: number };

/** What the shop is showing for this product, by the same rule the shop uses:
 *  our pictures only when the switch is on *and* there is at least one. */
function imageLabel(s: ImageStatus | undefined) {
  // Clips only play when the switch is on, so they are counted as live by the
  // same test the pictures are and simply added to whichever label wins.
  const clips = s?.useCustom && s.videoCount > 0 ? ` +${s.videoCount} วิดีโอ` : "";
  if (s?.useCustom && s.count > 0)
    return { text: `ของเรา (${s.count})${clips}`, className: "text-emerald-700 bg-emerald-50" };
  if (s && s.count > 0)
    return { text: `อัปไว้ ${s.count} — ยังไม่เปิด`, className: "text-amber-700 bg-amber-50" };
  return { text: `Shopify${clips}`, className: "text-slate-500 bg-slate-50" };
}

export default function ProductContentListPage() {
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});
  const [imageStatus, setImageStatus] = useState<Record<string, ImageStatus>>({});
  const [customImagesOnly, setCustomImagesOnly] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [brand, setBrand] = useState("all");

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

    fetch("/api/admin/product-content/image-status")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, ImageStatus> = {};
        for (const row of d?.items ?? [])
          map[row.variantId] = {
            useCustom: row.useCustom,
            count: row.count,
            videoCount: row.videoCount ?? 0,
          };
        setImageStatus(map);
      })
      .catch(() => {});
  }, []);

  const rows = useMemo(
    () =>
      products.map((p) => {
        // Content is pinned to a fixed variant (see stableContentVariantId),
        // not p.variantId — that field is recomputed as the cheapest in-stock
        // variant on every build and would silently detach written content
        // from its row the day a price or stock level changes.
        const contentVariantId = stableContentVariantId(p);
        const sku =
          p.variants.find((v) => v.variantId === contentVariantId)?.sku ?? null;
        const override = overrides[contentVariantId];
        const status: Status = !override
          ? "none"
          : override.published
            ? "published"
            : "draft";
        return {
          product: p,
          contentVariantId,
          sku,
          status,
          // Matched on the stable variant alone, the same key the editor
          // writes under — the editor is the only way a row gets here.
          images: imageStatus[contentVariantId],
        };
      }),
    [overrides, imageStatus],
  );

  // Vendor as the catalogue spells it, which is what these products are filed
  // under; alphabetical rather than by size, because somebody filtering by
  // brand already knows which one they want and is looking for its name.
  const brandOptions = useMemo(() => {
    const counted = new Map<string, number>();
    for (const r of rows)
      counted.set(r.product.brand, (counted.get(r.product.brand) ?? 0) + 1);
    return [...counted.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "th"),
    );
  }, [rows]);

  // The brand narrows everything below it, including the progress bar and the
  // status counts. "How far along is Dentiste" is the question a brand filter
  // is for, and counts that stayed at the whole catalogue could not answer it.
  const inBrand =
    brand === "all" ? rows : rows.filter((r) => r.product.brand === brand);

  const q = query.trim().toLowerCase();
  const filtered = inBrand.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (
      customImagesOnly &&
      !(r.images?.useCustom && (r.images.count > 0 || r.images.videoCount > 0))
    )
      return false;
    if (!q) return true;
    return (
      r.product.name.toLowerCase().includes(q) ||
      (r.sku ?? "").toLowerCase().includes(q)
    );
  });
  const shown = filtered.slice(0, 200);

  const customImageCount = inBrand.filter(
    (r) => r.images?.useCustom && (r.images.count > 0 || r.images.videoCount > 0),
  ).length;

  const counts = inBrand.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { published: 0, draft: 0, none: 0 } as Record<Status, number>,
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
            style={{
              width: `${inBrand.length > 0 ? Math.round((counts.published / inBrand.length) * 100) : 0}%`,
            }}
          />
        </div>
        <span className="text-xs text-slate-500">
          เผยแพร่แล้ว {counts.published.toLocaleString("th-TH")} · ร่าง{" "}
          {counts.draft.toLocaleString("th-TH")} · ยังไม่มีเนื้อหา{" "}
          {counts.none.toLocaleString("th-TH")} (จากทั้งหมด{" "}
          {inBrand.length.toLocaleString("th-TH")})
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหา SKU หรือชื่อสินค้า…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-hidden focus:border-brand-teal"
          />
        </div>
        <AdminSelect
          label="กรองตามแบรนด์"
          value={brand}
          onChange={setBrand}
          options={[
            { value: "all", label: `ทุกแบรนด์ (${rows.length.toLocaleString("th-TH")})` },
            ...brandOptions.map(([name, n]) => ({
              value: name,
              label: `${name} (${n.toLocaleString("th-TH")})`,
            })),
          ]}
        />
        <div className="inline-flex rounded-full bg-surface-muted p-1 text-xs">
          {(
            [
              ["all", `ทั้งหมด ${inBrand.length.toLocaleString("th-TH")}`],
              [
                "none",
                `ยังไม่มีเนื้อหา ${counts.none.toLocaleString("th-TH")}`,
              ],
              ["draft", `ร่าง ${counts.draft.toLocaleString("th-TH")}`],
              [
                "published",
                `เผยแพร่แล้ว ${counts.published.toLocaleString("th-TH")}`,
              ],
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

        {/* Its own control rather than a fifth status: which pictures a
            product uses and how far its write-up has got are two different
            questions, and filtering by both at once is a fair thing to want. */}
        <button
          type="button"
          onClick={() => setCustomImagesOnly((v) => !v)}
          aria-pressed={customImagesOnly}
          className={
            customImagesOnly
              ? "rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              : "rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-surface-line hover:text-brand-ink"
          }
        >
          ใช้รูปของเรา {customImageCount.toLocaleString("th-TH")}
        </button>
      </div>

      <div
        className={`mt-4 rounded-xl2 bg-white ring-1 ring-surface-line ${adminTable.scroll}`}
      >
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th>สินค้า</th>
              <th>SKU</th>
              <th>สถานะ</th>
              <th>รูป</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ product: p, contentVariantId, sku, status, images }) => {
              const St = STATUS_LABEL[status];
              const img = imageLabel(images);
              return (
                <tr key={contentVariantId} className={adminTable.row}>
                  <td className={adminTable.cell}>
                    <Link
                      href={`/admin/products/content/${encodeURIComponent(contentVariantId)}`}
                      className="flex items-center gap-2.5 hover:text-brand-800"
                    >
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface-soft ring-1 ring-surface-line">
                        {p.image && (
                          <Image
                            src={p.image}
                            alt=""
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 truncate font-medium text-brand-ink">
                        {p.name}
                      </span>
                    </Link>
                  </td>
                  <td className={adminTable.mono}>{sku ?? "—"}</td>
                  <td className={adminTable.cell}>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${St.className}`}
                    >
                      <St.icon size={12} aria-hidden="true" />
                      {St.label}
                    </span>
                  </td>
                  <td className={adminTable.cell}>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${img.className}`}
                    >
                      {img.text}
                    </span>
                  </td>
                </tr>
              );
            })}
            {loaded && shown.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-sm text-slate-400"
                >
                  ไม่พบรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > shown.length && (
        <p className="mt-2 text-xs text-slate-400">
          แสดง {shown.length} จาก {filtered.length.toLocaleString("th-TH")}{" "}
          รายการ — พิมพ์ค้นหาเพื่อแคบลง
        </p>
      )}
    </div>
  );
}

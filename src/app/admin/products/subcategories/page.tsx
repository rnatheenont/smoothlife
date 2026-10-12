"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, CircleHelp, Loader2, Sparkles } from "lucide-react";

import { PageHeader, adminTable } from "@/components/admin/layout-kit";
import AdminSelect from "@/components/admin/AdminSelect";
import AdminSearch from "@/components/admin/AdminSearch";
import { Card } from "@/components/ui";
import { categories } from "@/data/categories";
import { SUBCATEGORIES } from "@/lib/subcategories";
import type { ProductShelf } from "@/lib/product-subcategories";

// The review queue for product subcategories.
//
// The rules in src/lib/subcategories.ts guess about three quarters of the
// catalogue from the words each product is sold under. Nothing they guess
// reaches a customer until someone here says so, because the quarter they
// get wrong is the quarter that matters: a shopper who opens "กันแดด" and
// finds a lip balm has been told something false by the shop.
//
// So the page is built around the work, not the data. Unreviewed rows sort
// to the top, the ones the rules could not guess at all above those, and the
// only bulk action accepts guesses — there is deliberately no bulk "reject",
// because undoing someone's reading is not a thing to do by accident.

const CATEGORY_OPTIONS = categories
  .filter((c) => SUBCATEGORIES[c.slug]?.length)
  .map((c) => ({ value: c.slug, label: c.nameTh }));

type Summary = { total: number; confirmed: number; guessed: number; unguessed: number };
type Shelf = { slug: string; nameTh: string };

export default function SubcategoryReviewPage() {
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]?.value ?? "");
  const [items, setItems] = useState<ProductShelf[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);

  const load = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/product-subcategories?category=${encodeURIComponent(category)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setItems(data.items);
      setShelves(data.shelves);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(slug: string, subcategory: string | null) {
    setSavingSlug(slug);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-subcategories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, slug, subcategory }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "บันทึกไม่สำเร็จ");
      // Patch in place rather than reloading: a reload re-sorts the table and
      // the row you just decided jumps away under the cursor, which makes
      // working down a list of 190 feel like whack-a-mole.
      setItems((prev) =>
        prev.map((it) =>
          it.slug === slug
            ? {
                ...it,
                decided: subcategory,
                decidedLabel: subcategory ? (shelves.find((s) => s.slug === subcategory)?.nameTh ?? subcategory) : null,
                confirmed: true,
              }
            : it
        )
      );
      setSummary((s) => (s ? { ...s, confirmed: s.confirmed + 1 } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingSlug(null);
    }
  }

  async function confirmAll() {
    setConfirmingAll(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-subcategories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, action: "confirm-all" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "ยืนยันไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยืนยันไม่สำเร็จ");
    } finally {
      setConfirmingAll(false);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (onlyPending && it.confirmed) return false;
      if (!q) return true;
      return it.name.toLowerCase().includes(q) || it.brand.toLowerCase().includes(q);
    });
  }, [items, query, onlyPending]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="หมวดย่อยของสินค้า"
        subtitle="ระบบเดาจากชื่อและคำโปรยของสินค้า แล้วให้คนยืนยัน — เฉพาะที่ยืนยันแล้วเท่านั้นที่ขึ้นหน้าเว็บ"
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="w-52">
            <AdminSelect
              label="หมวดหมู่"
              value={category}
              onChange={setCategory}
              options={CATEGORY_OPTIONS}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <AdminSearch value={query} onChange={setQuery} placeholder="ค้นหาชื่อสินค้าหรือแบรนด์…" />
          </div>
          <label className="flex h-11 cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className="h-4 w-4 accent-brand-emerald"
            />
            เฉพาะที่ยังไม่ยืนยัน
          </label>
          {summary && summary.guessed > 0 && (
            <button
              onClick={confirmAll}
              disabled={confirmingAll}
              className="flex h-11 items-center gap-2 rounded-full bg-brand-gradient px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {confirmingAll ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              ยืนยันที่ระบบเดาไว้ทั้งหมด ({summary.guessed})
            </button>
          )}
        </div>

        {summary && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-[13px] text-slate-600">
            <span>ทั้งหมด {summary.total.toLocaleString("th-TH")}</span>
            <span className="text-brand-800">ยืนยันแล้ว {summary.confirmed.toLocaleString("th-TH")}</span>
            <span>ระบบเดาไว้ รอยืนยัน {summary.guessed.toLocaleString("th-TH")}</span>
            <span className="text-amber-700">เดาไม่ได้ ต้องเลือกเอง {summary.unguessed.toLocaleString("th-TH")}</span>
          </div>
        )}

        {error && <p className="px-4 pb-3 text-sm text-rose-600">{error}</p>}

        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">กำลังโหลด…</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {onlyPending ? "ยืนยันครบทุกชิ้นในหมวดนี้แล้ว" : "ไม่พบสินค้าที่ตรงกับคำค้น"}
          </p>
        ) : (
          <div className={`${adminTable.scroll} max-h-[62vh]`}>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className="px-3 py-2.5">สินค้า</th>
                  <th className="px-3 py-2.5 w-40">ระบบเดา</th>
                  <th className="px-3 py-2.5 w-56">หมวดย่อย</th>
                  <th className="px-3 py-2.5 w-24">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => (
                  <tr key={it.slug} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <div className="flex items-center gap-2.5">
                        {it.image && (
                          <Image
                            src={it.image}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 rounded-lg object-contain"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-brand-ink">{it.name}</p>
                          <p className="truncate text-[12px] text-slate-400">{it.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className={adminTable.muted}>
                      {it.guess ? (
                        (shelves.find((s) => s.slug === it.guess)?.nameTh ?? it.guess)
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <CircleHelp size={13} /> เดาไม่ได้
                        </span>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      <select
                        value={it.decided ?? it.guess ?? ""}
                        disabled={savingSlug === it.slug}
                        onChange={(e) => decide(it.slug, e.target.value || null)}
                        className="h-10 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-hidden focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/30 disabled:opacity-60"
                      >
                        {/* An empty value is a decision too: "this belongs on
                            no shelf", which is the right answer for a gift set
                            or a one-off and must be saveable. */}
                        <option value="">— ไม่จัดหมวดย่อย —</option>
                        {shelves.map((s) => (
                          <option key={s.slug} value={s.slug}>
                            {s.nameTh}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={adminTable.cell}>
                      {savingSlug === it.slug ? (
                        <Loader2 size={15} className="animate-spin text-slate-400" />
                      ) : it.confirmed ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-800">
                          <CheckCircle2 size={14} /> ยืนยันแล้ว
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-400">รอยืนยัน</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

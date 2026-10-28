"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Check, Copy, Percent, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@heroui/react";
import { Badge } from "@/components/ui";
import AdminField from "@/components/admin/AdminField";
import { Panel, adminTable } from "@/components/admin/layout-kit";
import { discountedPrice, type StaffRoundTo } from "@/lib/staff-sale";
import type { CollectionSummary, PickerProduct, StaffRoundItemView } from "./types";

// The price list of one round: what is on sale, for how much, and how many.
//
// Prices are stored, not computed. "ตั้งส่วนลด X% ทั้งหมด" writes a number
// into every row and then forgets the percentage — so a row edited by hand
// afterwards stays edited, and nothing re-prices an item somebody has
// already been quoted.

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type Draft = {
  staff_price: string;
  per_person_limit: string;
  total_quota: string;
};

export default function ItemsTab({
  roundId,
  items,
  busy,
  otherRounds,
  onError,
  onReload,
}: {
  roundId: string;
  items: StaffRoundItemView[];
  busy: boolean;
  /** Rounds to copy a price list from — this one excluded. */
  otherRounds: { id: string; name: string }[];
  onError: (msg: string | null) => void;
  onReload: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [collection, setCollection] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PickerProduct[]>([]);
  const [chosen, setChosen] = useState<Record<string, PickerProduct["variants"][number] & { slug: string }>>({});
  const [searching, setSearching] = useState(false);
  const [percent, setPercent] = useState("40");
  // Whole baht by default: no satang on a price list people read off a
  // screen, and the discount still lands within a couple of points of the
  // one that was typed. "ไม่ปัด" is there for when it has to be exact.
  const [roundTo, setRoundTo] = useState<"0" | "1" | "5" | "10">("1");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [copyFrom, setCopyFrom] = useState("");
  // Narrows what is already on screen. The box above it goes to the server
  // and replaces the list; a collection of 239 needs one that does not.
  const [filter, setFilter] = useState("");
  // The price list's own search, separate from the picker's two above: this
  // one narrows the rows already saved in the round. A round of 387 rows is
  // not something anyone scrolls to find one toothbrush in.
  const [rowQuery, setRowQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const already = new Set(items.map((i) => i.variant_id));

  // Name, SKU, size, brand and the slug all count, because all five are
  // things somebody holding a product might type. Matched word by word so
  // "ortho 6580" finds the row that "ortho" and "6580" both appear in,
  // whichever order they were typed.
  const words = rowQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown =
    words.length === 0
      ? items
      : items.filter((i) => {
          const hay = [i.name, i.brand, i.sku, i.size, i.product_slug, i.variant_id.split("/").pop()]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return words.every((w) => hay.includes(w));
        });

  const loadCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff-sale/catalogue", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setCollections(json.collections ?? []);
    } catch {
      // The picker still works by search; a missing collection list is not
      // worth an error banner over the price list.
    }
  }, []);

  useEffect(() => {
    if (picker && collections.length === 0) void loadCollections();
  }, [picker, collections.length, loadCollections]);

  async function search(params: string) {
    setSearching(true);
    onError(null);
    // The filter belongs to the list on screen, so it goes when that list
    // is replaced — otherwise a new collection arrives already hidden.
    setFilter("");
    try {
      const res = await fetch(`/api/admin/staff-sale/catalogue?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ค้นหาไม่สำเร็จ");
      setFound(json.products ?? []);
    } catch (err) {
      onError(err instanceof Error ? err.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setSearching(false);
    }
  }

  async function addChosen() {
    const picked = Object.values(chosen);
    if (picked.length === 0) return;
    onError(null);
    // The staff price is seeded from the current discount box so the common
    // case — "add these forty products at 40% off" — is one trip, and every
    // row can still be corrected afterwards.
    const pct = Number(percent);
    const rt = Number(roundTo) as StaffRoundTo;
    const body = {
      items: picked.map((v) => ({
        variant_id: v.variant_id,
        product_slug: v.slug,
        collection_handle: collection || null,
        regular_price: v.price,
        staff_price:
          Number.isFinite(pct) && pct > 0 && pct < 100
            ? discountedPrice(v.price, pct, rt)
            : Math.max(1, Math.floor(v.price * 0.6)),
        per_person_limit: null,
        total_quota: null,
        enabled: true,
      })),
    };
    const res = await fetch(`/api/admin/staff-sale/rounds/${roundId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) {
      onError(json.error ?? "เพิ่มสินค้าไม่สำเร็จ");
      return;
    }
    setChosen({});
    setFilter("");
    setPicker(false);
    onReload();
  }

  async function copyRound() {
    if (!copyFrom) return;
    onError(null);
    const res = await fetch(`/api/admin/staff-sale/rounds/${roundId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyFrom }),
    });
    const json = await res.json();
    if (!json.ok) {
      onError(json.error ?? "คัดลอกไม่สำเร็จ");
      return;
    }
    setCopyFrom("");
    onReload();
  }

  async function reprice() {
    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      onError("ส่วนลดต้องอยู่ระหว่าง 1–99%");
      return;
    }
    if (
      !confirm(
        `ตั้งราคาพนักงานทุกรายการเป็นส่วนลด ${pct}% จากราคาปกติ (${
          roundTo === "0" ? "ไม่ปัดเศษ" : `ปัดลงเป็นหลัก ${roundTo} บาท`
        })?\nราคาที่แก้ไว้เองจะถูกเขียนทับ` +
          // The search narrows the table, not this button — it reprices the
          // round on the server. Said out loud, because somebody who has
          // just filtered to three rows will read "ทั้งหมด" as those three
          // and overwrite three hundred hand-set prices.
          (words.length > 0
            ? `\n\nรวมรายการที่ช่องค้นหาซ่อนอยู่ด้วย — ทั้งหมด ${items.length} รายการ ไม่ใช่ ${shown.length} รายการที่เห็น`
            : ""),
      )
    ) {
      return;
    }
    onError(null);
    const res = await fetch(`/api/admin/staff-sale/rounds/${roundId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bulk: { percent: pct, roundTo: Number(roundTo) } }),
    });
    const json = await res.json();
    if (!json.ok) {
      onError(json.error ?? "ตั้งราคาไม่สำเร็จ");
      return;
    }
    onReload();
  }

  async function saveRow(item: StaffRoundItemView) {
    const d = drafts[item.id];
    setSaving(item.id);
    onError(null);
    const res = await fetch(`/api/admin/staff-sale/rounds/${roundId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        staff_price: d?.staff_price ?? item.staff_price,
        per_person_limit: d?.per_person_limit ?? item.per_person_limit ?? "",
        total_quota: d?.total_quota ?? item.total_quota ?? "",
        enabled: item.enabled,
      }),
    });
    const json = await res.json();
    setSaving(null);
    if (!json.ok) {
      onError(json.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setDrafts((cur) => {
      const next = { ...cur };
      delete next[item.id];
      return next;
    });
    onReload();
  }

  async function toggle(item: StaffRoundItemView) {
    onError(null);
    const res = await fetch(`/api/admin/staff-sale/rounds/${roundId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        staff_price: item.staff_price,
        per_person_limit: item.per_person_limit ?? "",
        total_quota: item.total_quota ?? "",
        enabled: !item.enabled,
      }),
    });
    const json = await res.json();
    if (!json.ok) onError(json.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
    else onReload();
  }

  async function remove(item: StaffRoundItemView) {
    if (!confirm("เอาสินค้านี้ออกจากรอบ?")) return;
    onError(null);
    const res = await fetch(
      `/api/admin/staff-sale/rounds/${roundId}/items?itemId=${encodeURIComponent(item.id)}`,
      { method: "DELETE" },
    );
    const json = await res.json();
    if (!json.ok) onError(json.error ?? "ลบไม่สำเร็จ");
    else onReload();
  }

  const chosenCount = Object.keys(chosen).length;

  const f = filter.trim().toLowerCase();
  const visible = f
    ? found.filter(
        (p) =>
          p.name.toLowerCase().includes(f) ||
          p.brand.toLowerCase().includes(f) ||
          p.variants.some((v) => v.sku?.toLowerCase().includes(f)),
      )
    : found;

  /** Every variant on screen that is not already in the round. */
  const selectable = visible.flatMap((p) =>
    p.variants.filter((v) => !already.has(v.variant_id)).map((v) => ({ ...v, slug: p.slug })),
  );
  const allPicked = selectable.length > 0 && selectable.every((v) => chosen[v.variant_id]);

  function selectAllVisible() {
    setChosen((cur) => {
      const next = { ...cur };
      // Pressed again when everything on screen is already picked, it clears
      // those — one button, and the second press undoes the first.
      if (allPicked) {
        for (const v of selectable) delete next[v.variant_id];
      } else {
        for (const v of selectable) next[v.variant_id] = v;
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Panel
        title={
          words.length > 0
            ? `สินค้าในรอบนี้ · ${shown.length} จาก ${items.length} รายการ`
            : `สินค้าในรอบนี้ · ${items.length} รายการ`
        }
        toolbar={
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-surface-soft px-2 py-1">
              <Percent className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              <input
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                inputMode="numeric"
                aria-label="ส่วนลดเป็นเปอร์เซ็นต์"
                className="w-12 rounded bg-transparent text-[13px] font-semibold text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-800/25"
              />
              <select
                value={roundTo}
                onChange={(e) => setRoundTo(e.target.value as "0" | "1" | "5" | "10")}
                aria-label="ปัดเศษ"
                className="rounded bg-transparent text-[12px] text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-800/25"
              >
                {/* Kept first: it is the only setting where the discount
                    comes out exactly as typed. Rounding to 5 turns 60% off
                    into 60–64% depending on the price; to the baht, 60–62.5%
                    — the cheaper the item, the further a floored baht moves
                    the percentage. */}
                <option value="0">ไม่ปัด</option>
                <option value="1">ปัดเป็นบาท</option>
                <option value="5">ปัดเป็น 5</option>
                <option value="10">ปัดเป็น 10</option>
              </select>
            </div>
            <Button size="sm" variant="ghost" onPress={reprice} isDisabled={busy || items.length === 0}>
              ตั้งราคาทั้งหมด
            </Button>
            <Button size="sm" onPress={() => setPicker((v) => !v)}>
              <Plus className="h-4 w-4" aria-hidden />
              เพิ่มสินค้า
            </Button>
          </div>
        }
      >
        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <label className="relative flex min-w-[260px] flex-1 items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden />
              <input
                value={rowQuery}
                onChange={(e) => setRowQuery(e.target.value)}
                type="search"
                placeholder="ค้นหาในรอบนี้ — ชื่อสินค้า, SKU, ขนาด หรือแบรนด์"
                aria-label="ค้นหาสินค้าในรอบนี้"
                className="h-10 w-full rounded-xl2 border border-slate-200 bg-white pl-9 pr-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
              />
            </label>
            {words.length > 0 && (
              <Button size="sm" variant="ghost" onPress={() => setRowQuery("")}>
                <X className="h-3.5 w-3.5" aria-hidden />
                ล้าง
              </Button>
            )}
          </div>
        )}

        <div className={`${adminTable.scroll} max-h-[560px]`}>
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th>สินค้า</th>
                <th>ราคาปกติ</th>
                <th>ราคาพนักงาน</th>
                <th>ส่วนลด</th>
                <th>จำกัด/คน</th>
                <th>โควตารวม</th>
                <th>ขาย/จอง</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className={adminTable.muted} colSpan={8}>
                    ยังไม่มีสินค้าในรอบนี้ — กด “เพิ่มสินค้า” หรือคัดลอกจากรอบก่อนด้านล่าง
                  </td>
                </tr>
              )}
              {items.length > 0 && shown.length === 0 && (
                <tr>
                  <td className={adminTable.muted} colSpan={8}>
                    ไม่พบสินค้าที่ตรงกับ “{rowQuery.trim()}” ในรอบนี้
                  </td>
                </tr>
              )}
              {shown.map((item) => {
                const d = drafts[item.id];
                const price = Number(d?.staff_price ?? item.staff_price);
                const off =
                  item.regular_price > 0
                    ? Math.round((1 - price / item.regular_price) * 100)
                    : 0;
                const dirty = Boolean(d);
                return (
                  <tr key={item.id} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <div className="flex items-start gap-2.5">
                        {/* Five rows reading the same slug are five different
                            sizes, and only the picture and the SKU say which
                            is which. */}
                        <span className="relative size-11 shrink-0 overflow-hidden rounded-m border border-slate-100 bg-white">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-contain"
                            />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-[10px] text-slate-300">
                              ไม่มีรูป
                            </span>
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium leading-snug text-brand-ink">
                            {item.name ?? item.product_slug}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                            {item.brand && <span>{item.brand}</span>}
                            {item.size && <span>{item.size}</span>}
                            {item.sku && <span className="font-mono text-slate-400">{item.sku}</span>}
                          </p>
                          {/* Kept, quietly: the slug and the variant id are
                              what a Shopify or database lookup needs when a
                              row is in dispute. */}
                          <p className="font-mono text-[10px] text-slate-300">
                            {item.product_slug} · {item.variant_id.split("/").pop()}
                          </p>
                          {!item.enabled && <Badge tone="neutral">ปิดการขายรายการนี้</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className={adminTable.mono}>{baht(item.regular_price)}</td>
                    <td className={adminTable.cell}>
                      <input
                        value={d?.staff_price ?? String(item.staff_price)}
                        onChange={(e) =>
                          setDrafts((cur) => ({
                            ...cur,
                            [item.id]: {
                              staff_price: e.target.value,
                              per_person_limit:
                                cur[item.id]?.per_person_limit ?? String(item.per_person_limit ?? ""),
                              total_quota: cur[item.id]?.total_quota ?? String(item.total_quota ?? ""),
                            },
                          }))
                        }
                        inputMode="decimal"
                        aria-label={`ราคาพนักงานของ ${item.name ?? item.product_slug}`}
                        className="w-24 rounded-xl2 border border-slate-200 px-2 py-1 font-mono text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                      />
                    </td>
                    <td className={adminTable.cell}>
                      {/* Said in the row rather than left to arithmetic: a
                          price typed one digit short is a 90% discount and
                          looks like any other number until it is a percentage. */}
                      <Badge tone={off >= 80 ? "danger" : off <= 0 ? "warning" : "success"}>
                        {off > 0 ? `-${off}%` : "ไม่ลด"}
                      </Badge>
                    </td>
                    <td className={adminTable.cell}>
                      <input
                        value={d?.per_person_limit ?? String(item.per_person_limit ?? "")}
                        onChange={(e) =>
                          setDrafts((cur) => ({
                            ...cur,
                            [item.id]: {
                              staff_price: cur[item.id]?.staff_price ?? String(item.staff_price),
                              per_person_limit: e.target.value,
                              total_quota: cur[item.id]?.total_quota ?? String(item.total_quota ?? ""),
                            },
                          }))
                        }
                        inputMode="numeric"
                        placeholder="ไม่จำกัด"
                        aria-label={`จำนวนจำกัดต่อคนของ ${item.name ?? item.product_slug}`}
                        className="w-20 rounded-xl2 border border-slate-200 px-2 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                      />
                    </td>
                    <td className={adminTable.cell}>
                      <input
                        value={d?.total_quota ?? String(item.total_quota ?? "")}
                        onChange={(e) =>
                          setDrafts((cur) => ({
                            ...cur,
                            [item.id]: {
                              staff_price: cur[item.id]?.staff_price ?? String(item.staff_price),
                              per_person_limit:
                                cur[item.id]?.per_person_limit ?? String(item.per_person_limit ?? ""),
                              total_quota: e.target.value,
                            },
                          }))
                        }
                        inputMode="numeric"
                        placeholder="ไม่จำกัด"
                        aria-label={`โควตารวมของ ${item.name ?? item.product_slug}`}
                        className="w-20 rounded-xl2 border border-slate-200 px-2 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                      />
                    </td>
                    <td className={adminTable.mono}>
                      {item.sold_qty}/{item.reserved_qty}
                    </td>
                    <td className={adminTable.cell}>
                      <div className="flex justify-end gap-1.5">
                        {dirty && (
                          <Button
                            size="sm"
                            onPress={() => saveRow(item)}
                            isDisabled={saving === item.id}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            บันทึก
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onPress={() => toggle(item)}>
                          {item.enabled ? "ปิดขาย" : "เปิดขาย"}
                        </Button>
                        {item.sold_qty === 0 && item.reserved_qty === 0 && (
                          <Button size="sm" variant="ghost" onPress={() => remove(item)}>
                            <Trash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Each round keeps its own products at its own prices, which is why
            the next round usually starts as the last one plus a few edits.
            Copying beats retyping sixty prices, which is how one gets typed
            wrong. Prices come across; what sold does not. */}
        {otherRounds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
            <label className="text-[12px] font-medium text-slate-500" htmlFor="copy-from-round">
              คัดลอกสินค้าและราคาจากรอบ
            </label>
            <select
              id="copy-from-round"
              value={copyFrom}
              onChange={(e) => setCopyFrom(e.target.value)}
              className="h-9 rounded-xl2 border border-slate-200 bg-white px-2 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
            >
              <option value="">— เลือกรอบ —</option>
              {otherRounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" onPress={copyRound} isDisabled={!copyFrom || busy}>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              คัดลอกมา
            </Button>
            <span className="text-[11px] text-slate-400">
              สินค้าที่มีอยู่แล้วในรอบนี้จะถูกข้าม ยอดขายไม่ถูกคัดลอกมา
            </span>
          </div>
        )}
      </Panel>

      {picker && (
        <Panel
          title="เลือกสินค้าเข้ารอบ"
          toolbar={
            <Button size="sm" variant="ghost" className="ml-auto" onPress={() => setPicker(false)}>
              <X className="h-4 w-4" aria-hidden />
              ปิด
            </Button>
          }
          padded
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12px] font-medium text-slate-500">
              เลือกจาก Collection
              <select
                value={collection}
                onChange={(e) => {
                  setCollection(e.target.value);
                  if (e.target.value) void search(`collection=${encodeURIComponent(e.target.value)}`);
                }}
                className="h-10 rounded-xl2 border border-slate-200 bg-white px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
              >
                <option value="">— เลือก —</option>
                {collections.map((c) => (
                  <option key={c.handle} value={c.handle}>
                    {c.title} · {c.count} รายการ
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-w-[220px] flex-1 items-end gap-2">
              <AdminField
                label="หรือค้นหาชื่อ / แบรนด์ / SKU"
                value={query}
                onChange={setQuery}
                placeholder="เช่น Dentiste หรือ DT-001"
                className="flex-1"
              />
              <Button
                size="sm"
                onPress={() => query.trim() && search(`q=${encodeURIComponent(query.trim())}`)}
                isDisabled={searching}
              >
                <Search className="h-4 w-4" aria-hidden />
                ค้นหา
              </Button>
            </div>
          </div>

          {collections.length === 0 && (
            <p className="mt-2 text-[12px] text-slate-400">
              รายการ Collection ถูกสร้างตอน build จาก Shopify — ในเครื่องจะว่าง ให้ใช้ช่องค้นหา
            </p>
          )}

          {/* Pick everything, then take out what is not wanted — which is
              the way round a collection of 239 is actually worked through.
              The filter narrows what "ทั้งหมด" means, so a brand or a size
              can be taken in one press. */}
          {found.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-slate-100 py-2">
              <Button size="sm" variant="ghost" onPress={selectAllVisible} isDisabled={selectable.length === 0}>
                {allPicked ? (
                  <>
                    <X className="h-3.5 w-3.5" aria-hidden />
                    เอาออกทั้งหมด ({selectable.length})
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    เลือกทั้งหมด ({selectable.length})
                  </>
                )}
              </Button>
              <div className="relative min-w-[200px] flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={`กรองใน ${found.length} รายการนี้`}
                  aria-label="กรองรายการที่แสดงอยู่"
                  className="h-9 w-full rounded-xl2 border border-slate-200 bg-white pl-8 pr-2 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                />
              </div>
              <span className="text-[12px] text-slate-500">
                เลือกแล้ว <span className="font-semibold text-brand-ink">{chosenCount}</span>
              </span>
            </div>
          )}

          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {found.length === 0 && !searching && (
              <p className="text-[13px] text-slate-400">ยังไม่มีผลค้นหา</p>
            )}
            {found.length > 0 && visible.length === 0 && (
              <p className="text-[13px] text-slate-400">ไม่พบสินค้าที่ตรงกับ “{filter.trim()}”</p>
            )}
            {visible.map((p) => (
              <div key={p.slug} className="rounded-xl2 bg-surface-soft p-3">
                <p className="text-[13px] font-semibold text-brand-ink">{p.name}</p>
                <p className="text-[11px] text-slate-400">{p.brand}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.variants.map((v) => {
                    const inList = already.has(v.variant_id);
                    const picked = Boolean(chosen[v.variant_id]);
                    return (
                      <button
                        key={v.variant_id}
                        onClick={() =>
                          setChosen((cur) => {
                            const next = { ...cur };
                            if (next[v.variant_id]) delete next[v.variant_id];
                            else next[v.variant_id] = { ...v, slug: p.slug };
                            return next;
                          })
                        }
                        disabled={inList}
                        className={`rounded-xl px-2.5 py-1.5 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 ${
                          inList
                            ? "cursor-not-allowed bg-white/60 text-slate-400"
                            : picked
                              ? "bg-brand-800 text-white"
                              : "bg-white text-slate-600 hover:text-brand-800"
                        }`}
                      >
                        <span className="font-medium">{v.size || "ปกติ"}</span>
                        <span className="ml-1.5 font-mono">{baht(v.price)}</span>
                        {inList && <span className="ml-1.5">· อยู่ในรอบแล้ว</span>}
                        {!inList && !v.in_stock && <span className="ml-1.5">· ของหมด</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onPress={addChosen} isDisabled={chosenCount === 0}>
              เพิ่ม {chosenCount} รายการ ที่ส่วนลด {percent}%
            </Button>
            {chosenCount > 0 && (
              <Button size="sm" variant="ghost" onPress={() => setChosen({})}>
                ล้างที่เลือก
              </Button>
            )}
            <p className="text-[12px] text-slate-400">
              ราคาพนักงานตั้งให้จากส่วนลดด้านบน แก้รายตัวได้หลังเพิ่ม
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}

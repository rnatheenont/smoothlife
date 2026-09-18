"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Loader2, Minus, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import FormDrawer from "@/components/flash-sale-demo/FormDrawer";
import { INTERVALS, STATUS_TH, type SubscriptionSetStatus } from "@/lib/subscription-sets";
import { formatTHB } from "@/lib/format";

// Admin → สินค้าสมัครสมาชิก → ชุดที่จัดไว้แล้ว. The shop assembles a bundle,
// prices it, and sells it as one subscription.
//
// Two things the screen has to make obvious, because both are easy to get
// wrong: what the set saves the customer against buying the same things
// separately, and that a set with anything out of stock is not being sold —
// a bundle is a promise about its contents.

type Item = { product_slug: string; product_variant_id: string | null; quantity: number };

type Described = Item & {
  name: string;
  image: string | null;
  brand: string;
  unitPrice: number;
  lineTotal: number;
  inStock: boolean;
  missing: boolean;
};

type SetRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  bundle_price: number | string;
  status: SubscriptionSetStatus;
  interval_days: number;
  subscription_set_items?: Item[];
  summary: {
    items: Described[];
    separately: number;
    bundle: number;
    saving: number;
    savingPercent: number;
    outOfStock: Described[];
    sellable: boolean;
  };
};

type Catalogue = { slug: string; name: string; brand: string; image: string; price: number; inStock: boolean };

const STATUS_TONE: Record<SubscriptionSetStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-slate-50 text-slate-600 ring-slate-200",
  archived: "bg-slate-50 text-slate-400 ring-slate-200",
};

const EMPTY = { name: "", description: "", image_url: "", bundle_price: "", status: "draft" as SubscriptionSetStatus, interval_days: 30 };

const field =
  "min-h-11 w-full rounded-xl2 border border-surface-line bg-white px-3 text-sm text-brand-ink focus:border-brand-800 focus:outline-none";

export default function SubscriptionSets({ catalogue }: { catalogue: Catalogue[] }) {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscription-sets", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดรายการชุดไม่สำเร็จ");
      setSets(data.sets);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายการชุดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bySlug = useMemo(() => new Map(catalogue.map((p) => [p.slug, p])), [catalogue]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalogue.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(q)).slice(0, 8);
  }, [catalogue, search]);

  // What the chosen products cost bought separately — the number the set's
  // price has to beat, shown as it is typed.
  const separately = items.reduce((total, i) => total + (bySlug.get(i.product_slug)?.price ?? 0) * i.quantity, 0);
  const price = Number(form.bundle_price);
  const savesBaht = Number.isFinite(price) && price > 0 && separately > price ? separately - price : 0;
  const savesPercent = savesBaht > 0 ? Math.round((savesBaht / separately) * 100) : 0;

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setItems([]);
    setSearch("");
    setOpen(true);
  };

  const startEdit = (set: SetRow) => {
    setEditingId(set.id);
    setForm({
      name: set.name,
      description: set.description ?? "",
      image_url: set.image_url ?? "",
      bundle_price: String(Number(set.bundle_price)),
      status: set.status,
      interval_days: set.interval_days,
    });
    setItems((set.subscription_set_items ?? []).map((i) => ({ ...i })));
    setSearch("");
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/admin/subscription-sets/${editingId}` : "/api/admin/subscription-sets", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, bundle_price: price, items }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (set: SetRow, status: SubscriptionSetStatus) => {
    await fetch(`/api/admin/subscription-sets/${set.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const remove = async (set: SetRow) => {
    if (!window.confirm(`ลบชุด "${set.name}"?`)) return;
    const res = await fetch(`/api/admin/subscription-sets/${set.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) setError(data.error || "ลบไม่สำเร็จ");
    await load();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          ชุดที่ทีมจัดไว้ให้ลูกค้ากดสมัครทีเดียว — ตั้งราคาชุดให้ถูกกว่าซื้อแยก · ชุดที่มีสินค้าใดหมด จะไม่ถูกขายจนกว่าจะเติมของ
        </p>
        <button
          type="button"
          onClick={startCreate}
          className="flex min-h-10 items-center gap-1.5 rounded-full bg-brand-800 px-4 text-sm font-semibold text-white"
        >
          <Plus size={15} /> สร้างชุดใหม่
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl2 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center">
          <Loader2 size={18} className="mx-auto animate-spin text-slate-300" />
        </p>
      ) : sets.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-surface-line p-10 text-center">
          <Package size={22} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">ยังไม่มีชุดที่จัดไว้</p>
          <button type="button" onClick={startCreate} className="mt-2 text-sm font-semibold text-brand-800 hover:underline">
            + สร้างชุดแรก
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sets.map((set) => (
            <li key={set.id} className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-brand-ink">{set.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_TONE[set.status]}`}>
                      {STATUS_TH[set.status]}
                    </span>
                    <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-slate-500">ส่งทุก {set.interval_days} วัน</span>
                  </p>

                  <p className="mt-1.5 flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="font-bold text-sale">{formatTHB(set.summary.bundle)}</span>
                    {set.summary.saving > 0 && (
                      <>
                        <span className="text-xs text-slate-400 line-through">{formatTHB(set.summary.separately)}</span>
                        <span className="text-xs font-semibold text-emerald-700">ประหยัด {set.summary.savingPercent}%</span>
                      </>
                    )}
                    <span className="text-xs text-slate-400">· {set.summary.items.length} รายการในชุด</span>
                  </p>

                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {set.summary.items.map((item) => (
                      <li
                        key={item.product_slug}
                        className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[11px] ring-1 ${
                          item.inStock ? "bg-surface-soft text-slate-600 ring-transparent" : "bg-amber-50 text-amber-800 ring-amber-200"
                        }`}
                      >
                        {item.image && (
                          <span className="relative size-5 overflow-hidden rounded-full bg-white">
                            <Image src={item.image} alt="" fill sizes="20px" className="object-cover" />
                          </span>
                        )}
                        <span className="max-w-40 truncate">{item.name}</span>
                        {item.quantity > 1 && <span className="font-semibold">×{item.quantity}</span>}
                      </li>
                    ))}
                  </ul>

                  {set.status === "active" && !set.summary.sellable && (
                    <p className="mt-2 flex items-center gap-1.5 rounded-xl2 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle size={13} className="shrink-0" />
                      ซ่อนจากหน้าร้านอยู่ — {set.summary.outOfStock.map((i) => i.name).join(", ")} หมดสต็อก
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStatus(set, set.status === "active" ? "draft" : "active")}
                    className="min-h-9 rounded-full px-3 text-sm font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft"
                  >
                    {set.status === "active" ? "หยุดขาย" : "เปิดขาย"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(set)}
                    className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-surface-soft"
                  >
                    <Pencil size={14} /> แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(set)}
                    aria-label={`ลบ ${set.name}`}
                    className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDrawer open={open} title={editingId ? "แก้ไขชุด" : "สร้างชุดใหม่"} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="set-name" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              ชื่อชุด
            </label>
            <input
              id="set-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="เช่น ชุดดูแลผิวหน้าครบวงจร"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="set-desc" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              คำอธิบาย (ไม่บังคับ)
            </label>
            <textarea
              id="set-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="บอกลูกค้าว่าชุดนี้เหมาะกับใคร ใช้ยังไง"
              className={`${field} py-2 leading-relaxed`}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-brand-ink">สินค้าในชุด ({items.length})</p>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาสินค้าเพื่อเพิ่มเข้าชุด"
                aria-label="ค้นหาสินค้า"
                className={`${field} pl-9`}
              />
            </div>

            {matches.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {matches.map((p) => {
                  const already = items.some((i) => i.product_slug === p.slug);
                  return (
                    <li key={p.slug}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => {
                          setItems((list) => [...list, { product_slug: p.slug, product_variant_id: null, quantity: 1 }]);
                          setSearch("");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl2 p-2 text-left hover:bg-surface-soft disabled:opacity-40"
                      >
                        <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-surface-line">
                          <Image src={p.image} alt="" fill sizes="36px" className="object-contain p-0.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-xs text-brand-ink">{p.name}</span>
                          <span className="text-[11px] text-slate-500">
                            {p.brand} · {formatTHB(p.price)}
                            {!p.inStock && " · สินค้าหมด"}
                          </span>
                        </span>
                        {already && <span className="text-[11px] text-slate-400">อยู่ในชุดแล้ว</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {items.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {items.map((item) => {
                  const p = bySlug.get(item.product_slug);
                  return (
                    <li key={item.product_slug} className="flex items-center gap-2 rounded-xl2 bg-surface-soft p-2">
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-white">
                        {p?.image && <Image src={p.image} alt="" fill sizes="36px" className="object-contain p-0.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-xs text-brand-ink">{p?.name ?? item.product_slug}</span>
                        <span className="text-[11px] text-slate-500">
                          {formatTHB((p?.price ?? 0) * item.quantity)}
                          {p && !p.inStock && " · สินค้าหมด"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="ลดจำนวน"
                          onClick={() =>
                            setItems((list) =>
                              list.map((i) => (i.product_slug === item.product_slug ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))
                            )
                          }
                          className="grid size-8 place-items-center rounded-full bg-white text-slate-600"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="เพิ่มจำนวน"
                          onClick={() =>
                            setItems((list) =>
                              list.map((i) => (i.product_slug === item.product_slug ? { ...i, quantity: Math.min(20, i.quantity + 1) } : i))
                            )
                          }
                          className="grid size-8 place-items-center rounded-full bg-white text-slate-600"
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`เอา ${p?.name ?? ""} ออกจากชุด`}
                          onClick={() => setItems((list) => list.filter((i) => i.product_slug !== item.product_slug))}
                          className="grid size-8 place-items-center rounded-full text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {items.length < 2 && <p className="mt-2 text-xs text-slate-500">ชุดต้องมีสินค้าอย่างน้อย 2 รายการ</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="set-price" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                ราคาชุด (บาท)
              </label>
              <input
                id="set-price"
                type="number"
                inputMode="decimal"
                min={1}
                value={form.bundle_price}
                onChange={(e) => setForm((f) => ({ ...f, bundle_price: e.target.value }))}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="set-interval" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                รอบจัดส่ง
              </label>
              <select
                id="set-interval"
                value={form.interval_days}
                onChange={(e) => setForm((f) => ({ ...f, interval_days: Number(e.target.value) }))}
                className={field}
              >
                {INTERVALS.map((d) => (
                  <option key={d} value={d}>
                    ทุก {d} วัน
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* The number the price has to beat, worked out as it is typed. */}
          <div className="rounded-xl2 bg-surface-soft p-3 text-sm">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-slate-600">ซื้อแยกรวม</span>
              <span className="font-semibold text-brand-ink">{formatTHB(separately)}</span>
            </p>
            <p className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-slate-600">ราคาชุด</span>
              <span className="font-bold text-sale">{price > 0 ? formatTHB(price) : "—"}</span>
            </p>
            <p className={`mt-1 text-xs font-semibold ${savesBaht > 0 ? "text-emerald-700" : "text-slate-400"}`}>
              {savesBaht > 0 ? `ลูกค้าประหยัด ${formatTHB(savesBaht)} (${savesPercent}%)` : "ตั้งราคาชุดให้ถูกกว่าซื้อแยก"}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-brand-ink">สถานะ</p>
            <div className="inline-flex rounded-full bg-surface-muted p-1">
              {(["draft", "active", "archived"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: s }))}
                  aria-pressed={form.status === s}
                  className={`min-h-9 rounded-full px-4 text-sm font-semibold transition ${
                    form.status === s ? "bg-white text-brand-ink shadow-card" : "text-slate-600 hover:text-brand-ink"
                  }`}
                >
                  {STATUS_TH[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-12 rounded-full px-5 text-sm font-semibold text-slate-600 ring-1 ring-surface-line"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || items.length < 2 || !form.name.trim() || !(price > 0)}
              className="min-h-12 flex-1 rounded-full bg-brand-800 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "สร้างชุด"}
            </button>
          </div>
        </div>
      </FormDrawer>
    </div>
  );
}

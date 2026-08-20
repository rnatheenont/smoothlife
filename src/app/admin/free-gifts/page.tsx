"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Gift,
  Check,
  Trash2,
  Power,
  Plus,
  X,
  ShoppingBag,
  Layers,
  TrendingUp,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { FreeGiftPromo, FreeGiftTier } from "@/data/free-gifts";
import { getProductBySlug } from "@/data/products";
import ProductPicker from "@/components/admin/ProductPicker";

type AdminPromo = FreeGiftPromo & { id: string };

type TierFormRow = { minSubtotal: string; giftProductSlug: string; giftQty: string };

type FormState = {
  slug: string;
  titleTh: string;
  titleEn: string;
  kind: "bxgy" | "spend" | "tiered";
  buyProductSlugs: string[];
  buyQty: string;
  minSubtotal: string;
  giftProductSlug: string;
  giftQty: string;
  tiers: TierFormRow[];
  expires: string;
};

const EMPTY_TIER_ROW: TierFormRow = { minSubtotal: "", giftProductSlug: "", giftQty: "1" };

const EMPTY_FORM: FormState = {
  slug: "",
  titleTh: "",
  titleEn: "",
  kind: "spend",
  buyProductSlugs: [],
  buyQty: "1",
  minSubtotal: "",
  giftProductSlug: "",
  giftQty: "1",
  tiers: [{ ...EMPTY_TIER_ROW }],
  expires: "",
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Plain-language sentence describing exactly what the customer will
// experience — shown both on the list and as a live preview in the form, so
// a non-technical operator never has to mentally translate the raw fields.
function describeCondition(p: {
  kind: "bxgy" | "spend" | "tiered";
  minSubtotal?: number | string;
  buyProductSlugs?: string[];
  buyQty?: number | string;
  tiers?: FreeGiftTier[] | TierFormRow[];
}) {
  if (p.kind === "spend") {
    const amount = p.minSubtotal || "___";
    return `ลูกค้าซื้อสินค้าอะไรก็ได้ครบ ฿${Number(amount).toLocaleString()}`;
  }
  if (p.kind === "tiered") {
    const tiers = p.tiers ?? [];
    if (tiers.length === 0) return "ยังไม่ได้ตั้งระดับ";
    return tiers
      .map((t, i) => `ครบ ฿${Number(t.minSubtotal || 0).toLocaleString()} → ระดับ ${i + 1}`)
      .join(", ");
  }
  const count = (p.buyProductSlugs ?? []).length;
  const qty = p.buyQty || "___";
  return `ลูกค้าซื้อสินค้าที่กำหนด (${count} รายการ) รวมครบ ${qty} ชิ้น`;
}

export default function AdminFreeGiftsPage() {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function loadList() {
    const res = await fetch("/api/admin/free-gifts");
    if (res.status === 401) return;
    const data = await res.json();
    setPromos(data.promos ?? []);
  }

  useEffect(() => {
    loadList();
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowAdvanced(false);
    setShowForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const body = {
        // slugify() drops any character outside a-z0-9 — a Thai-only title
        // (titleEn blank) collapses to an empty string, so fall back to a
        // generated id rather than submitting a slug that fails validation.
        slug: form.slug || slugify(form.titleEn || form.titleTh) || `promo-${Date.now().toString(36)}`,
        titleTh: form.titleTh,
        titleEn: form.titleEn || form.titleTh,
        kind: form.kind,
        buyProductSlugs: form.kind === "bxgy" ? form.buyProductSlugs : undefined,
        buyQty: form.kind === "bxgy" ? Number(form.buyQty) : undefined,
        minSubtotal: form.kind === "spend" ? Number(form.minSubtotal) : undefined,
        giftProductSlug: form.kind === "tiered" ? undefined : form.giftProductSlug,
        giftQty: form.kind === "tiered" ? undefined : Number(form.giftQty) || 1,
        tiers:
          form.kind === "tiered"
            ? form.tiers.map((t) => ({
                minSubtotal: Number(t.minSubtotal),
                giftProductSlug: t.giftProductSlug,
                giftQty: Number(t.giftQty) || 1,
              }))
            : undefined,
        expires: form.expires || undefined,
      };
      const url = editingId ? `/api/admin/free-gifts/${editingId}` : "/api/admin/free-gifts";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setFormError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setShowForm(false);
      loadList();
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(p: AdminPromo) {
    setEditingId(p.id);
    setForm({
      slug: p.slug,
      titleTh: p.titleTh,
      titleEn: p.titleEn,
      kind: p.kind,
      buyProductSlugs: p.buyProductSlugs ?? [],
      buyQty: String(p.buyQty ?? 1),
      minSubtotal: String(p.minSubtotal ?? ""),
      giftProductSlug: p.giftProductSlug,
      giftQty: String(p.giftQty ?? 1),
      tiers:
        p.tiers && p.tiers.length > 0
          ? p.tiers.map((t) => ({
              minSubtotal: String(t.minSubtotal),
              giftProductSlug: t.giftProductSlug,
              giftQty: String(t.giftQty ?? 1),
            }))
          : [{ ...EMPTY_TIER_ROW }],
      expires: p.expires ?? "",
    });
    setFormError("");
    setShowAdvanced(false);
    setShowForm(true);
  }

  async function activate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/free-gifts/${id}/activate`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "เปิดใช้งานไม่สำเร็จ");
        return;
      }
      loadList();
    } finally {
      setBusyId(null);
    }
  }

  async function deactivate(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/free-gifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      loadList();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("ลบโปรโมชั่นนี้? กู้คืนไม่ได้")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/free-gifts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) alert(data.error || "ลบไม่สำเร็จ");
      loadList();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2">
          <Gift size={22} className="text-brand-emerald" /> ของแถม & โปรโมชั่น
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          ตั้งโปร &ldquo;ซื้อครบแถมฟรี&rdquo; — ระบบจะเพิ่มของแถมในตะกร้าลูกค้าอัตโนมัติ และผูกกับส่วนลดจริงใน Shopify ให้ทันที
        </p>
      </div>

      <button
        onClick={openCreateForm}
        className="w-full mb-6 flex items-center justify-center gap-2 rounded-xl2 border-2 border-dashed border-slate-200 hover:border-brand-teal text-slate-500 hover:text-brand-emerald py-4 text-sm font-semibold transition-colors"
      >
        <Plus size={17} /> สร้างโปรโมชั่นใหม่
      </button>

      {promos.length === 0 ? (
        <div className="text-center py-10">
          <Sparkles size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">ยังไม่มีโปรโมชั่น — กดปุ่มด้านบนเพื่อเริ่มสร้างโปรแรก</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => {
            const giftProduct = p.kind === "tiered" ? undefined : getProductBySlug(p.giftProductSlug);
            const KindIcon = p.kind === "spend" ? ShoppingBag : p.kind === "bxgy" ? Layers : TrendingUp;
            const kindLabel = p.kind === "spend" ? "ซื้อครบยอด" : p.kind === "bxgy" ? "ซื้อครบจำนวน" : "ขั้นบันได";
            const tierDiscountsLinked = p.kind === "tiered" && (p.tiers ?? []).every((t) => t.shopifyDiscountId);
            return (
              <div key={p.id} className="rounded-xl2 border border-slate-100 p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-surface-soft grid place-items-center">
                    {giftProduct ? (
                      <Image src={giftProduct.image} alt={giftProduct.name} fill sizes="56px" className="object-cover" />
                    ) : p.kind === "tiered" ? (
                      <TrendingUp size={20} className="text-slate-300" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          p.active ? "bg-brand-gradient-soft text-brand-emerald" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${p.active ? "bg-brand-emerald" : "bg-slate-300"}`} />
                        {p.active ? "กำลังใช้งานจริง" : "ร่าง — ยังไม่เปิดใช้งาน"}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <KindIcon size={11} /> {kindLabel}
                      </span>
                    </div>
                    <p className="font-bold text-brand-ink mt-1">{p.titleTh}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.kind === "tiered" ? (
                        describeCondition(p)
                      ) : (
                        <>
                          {describeCondition(p)} → <span className="font-semibold text-brand-ink">รับฟรี {giftProduct?.name ?? p.giftProductSlug} x{p.giftQty}</span>
                        </>
                      )}
                    </p>
                    {(p.shopifyDiscountId || tierDiscountsLinked) && (
                      <p className="flex items-center gap-1 text-[10px] text-brand-emerald mt-1">
                        <Check size={11} /> เชื่อมกับส่วนลดจริงใน Shopify แล้ว
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {!p.active && (
                    <button
                      onClick={() => activate(p.id)}
                      disabled={busyId === p.id}
                      className="flex items-center gap-1 rounded-full bg-brand-gradient text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
                    >
                      <Check size={12} /> {busyId === p.id ? "กำลังเปิดใช้งาน..." : "เปิดใช้งานจริง"}
                    </button>
                  )}
                  {p.active && (
                    <button
                      onClick={() => deactivate(p.id)}
                      disabled={busyId === p.id}
                      className="flex items-center gap-1 rounded-full border border-slate-200 text-slate-500 text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
                    >
                      <Power size={12} /> ปิดใช้งาน
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(p)}
                    className="rounded-full border border-slate-200 text-slate-500 text-xs font-semibold px-3 py-1.5"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    disabled={p.active || busyId === p.id}
                    title={p.active ? "ปิดใช้งานก่อนถึงจะลบได้" : "ลบโปรโมชั่นนี้"}
                    className="flex items-center gap-1 rounded-full border border-rose-200 text-rose-500 text-xs font-semibold px-3 py-1.5 disabled:opacity-30"
                  >
                    <Trash2 size={12} /> ลบ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl2 bg-white p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-brand-ink text-lg">{editingId ? "แก้ไขโปรโมชั่น" : "สร้างโปรโมชั่นใหม่"}</h2>
              <button onClick={() => setShowForm(false)} aria-label="ปิด">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitForm} className="space-y-5">
              {/* 1. ชื่อโปร */}
              <div>
                <p className="text-xs font-bold text-brand-ink mb-2">1. ตั้งชื่อโปรโมชั่น</p>
                <label className="block text-[11px] text-slate-400 mb-1">ชื่อที่ลูกค้าจะเห็น (ภาษาไทย)</label>
                <input
                  value={form.titleTh}
                  onChange={(e) => setForm({ ...form, titleTh: e.target.value })}
                  placeholder="เช่น ซื้อครบ 990 รับกระเป๋าฟรี"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-2"
                />
                <label className="block text-[11px] text-slate-400 mb-1">ชื่อภาษาอังกฤษ (ไม่บังคับ)</label>
                <input
                  value={form.titleEn}
                  onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                  placeholder="เช่น Spend ฿990, get a free bag"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              {/* 2. เงื่อนไข */}
              <div>
                <p className="text-xs font-bold text-brand-ink mb-2">2. เงื่อนไขการรับของแถม</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kind: "spend" })}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      form.kind === "spend" ? "border-brand-teal bg-brand-gradient-soft" : "border-slate-200"
                    }`}
                  >
                    <ShoppingBag size={16} className="text-brand-emerald mb-1" />
                    <p className="text-xs font-bold text-brand-ink">ซื้อครบยอด</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">ซื้ออะไรก็ได้ครบยอดที่กำหนด</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kind: "bxgy" })}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      form.kind === "bxgy" ? "border-brand-teal bg-brand-gradient-soft" : "border-slate-200"
                    }`}
                  >
                    <Layers size={16} className="text-brand-emerald mb-1" />
                    <p className="text-xs font-bold text-brand-ink">ซื้อครบจำนวน</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">ต้องซื้อสินค้าที่กำหนดครบจำนวน</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kind: "tiered" })}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      form.kind === "tiered" ? "border-brand-teal bg-brand-gradient-soft" : "border-slate-200"
                    }`}
                  >
                    <TrendingUp size={16} className="text-brand-emerald mb-1" />
                    <p className="text-xs font-bold text-brand-ink">แบบขั้นบันได</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">ยิ่งซื้อเยอะ ยิ่งได้ของแถมมากขึ้น</p>
                  </button>
                </div>

                {form.kind === "spend" ? (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ยอดขั้นต่ำ (บาท)</label>
                    <input
                      type="number"
                      value={form.minSubtotal}
                      onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
                      placeholder="เช่น 990"
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                ) : form.kind === "bxgy" ? (
                  <div className="space-y-2">
                    <label className="block text-[11px] text-slate-400">สินค้าที่ลูกค้าต้องซื้อ (เลือกได้หลายชิ้น)</label>
                    {form.buyProductSlugs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {form.buyProductSlugs.map((s) => {
                          const p = getProductBySlug(s);
                          return (
                            <span key={s} className="flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-xs">
                              {p?.name ?? s}
                              <button
                                type="button"
                                onClick={() => setForm({ ...form, buyProductSlugs: form.buyProductSlugs.filter((x) => x !== s) })}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <ProductPicker
                      onSelect={(slug) =>
                        setForm((f) => ({
                          ...f,
                          buyProductSlugs: f.buyProductSlugs.includes(slug) ? f.buyProductSlugs : [...f.buyProductSlugs, slug],
                        }))
                      }
                    />
                    <label className="block text-[11px] text-slate-400 mb-1 mt-2">จำนวนที่ต้องซื้อรวม (ชิ้น)</label>
                    <input
                      type="number"
                      value={form.buyQty}
                      onChange={(e) => setForm({ ...form, buyQty: e.target.value })}
                      placeholder="เช่น 2"
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-[11px] text-slate-400">
                      ตั้งระดับยอดซื้อ → ของแถมของระดับนั้น (เรียงจากน้อยไปมาก ระดับหลังจะได้ของแถมของระดับก่อนหน้าด้วย)
                    </label>
                    {form.tiers.map((tier, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-brand-ink">ระดับ {i + 1}</span>
                          {form.tiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, idx) => idx !== i) })}
                            >
                              <X size={13} className="text-slate-400" />
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          value={tier.minSubtotal}
                          onChange={(e) => {
                            const next = [...form.tiers];
                            next[i] = { ...next[i], minSubtotal: e.target.value };
                            setForm({ ...form, tiers: next });
                          }}
                          placeholder="ยอดขั้นต่ำของระดับนี้ (บาท)"
                          required
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        {tier.giftProductSlug ? (
                          <div className="flex items-center gap-2 rounded-lg bg-surface-soft p-1.5">
                            <span className="text-xs text-brand-ink flex-1">{getProductBySlug(tier.giftProductSlug)?.name ?? tier.giftProductSlug}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...form.tiers];
                                next[i] = { ...next[i], giftProductSlug: "" };
                                setForm({ ...form, tiers: next });
                              }}
                            >
                              <X size={13} className="text-slate-400" />
                            </button>
                          </div>
                        ) : (
                          <ProductPicker
                            onSelect={(slug) => {
                              const next = [...form.tiers];
                              next[i] = { ...next[i], giftProductSlug: slug };
                              setForm({ ...form, tiers: next });
                            }}
                          />
                        )}
                        <input
                          type="number"
                          value={tier.giftQty}
                          onChange={(e) => {
                            const next = [...form.tiers];
                            next[i] = { ...next[i], giftQty: e.target.value };
                            setForm({ ...form, tiers: next });
                          }}
                          placeholder="จำนวนที่แถมในระดับนี้"
                          required
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tiers: [...form.tiers, { ...EMPTY_TIER_ROW }] })}
                      className="flex items-center gap-1 text-xs font-semibold text-brand-emerald"
                    >
                      <Plus size={13} /> เพิ่มระดับ
                    </button>
                  </div>
                )}
              </div>

              {/* 3. ของแถม (spend/bxgy only — tiered sets gift per level above) */}
              {form.kind !== "tiered" && (
                <div>
                  <p className="text-xs font-bold text-brand-ink mb-2">3. สินค้าที่จะแถมฟรี</p>
                  {form.giftProductSlug ? (
                    <div className="flex items-center gap-2.5 rounded-lg bg-surface-soft p-2 mb-2">
                      {(() => {
                        const gp = getProductBySlug(form.giftProductSlug);
                        return gp ? (
                          <>
                            <span className="relative h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-white">
                              <Image src={gp.image} alt={gp.name} fill sizes="36px" className="object-cover" />
                            </span>
                            <span className="text-xs text-brand-ink flex-1">{gp.name}</span>
                            <button type="button" onClick={() => setForm({ ...form, giftProductSlug: "" })}>
                              <X size={14} className="text-slate-400" />
                            </button>
                          </>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <ProductPicker onSelect={(slug) => setForm({ ...form, giftProductSlug: slug })} />
                  )}
                  <label className="block text-[11px] text-slate-400 mb-1 mt-2">จำนวนที่แถม (ชิ้น)</label>
                  <input
                    type="number"
                    value={form.giftQty}
                    onChange={(e) => setForm({ ...form, giftQty: e.target.value })}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {/* preview */}
              {form.titleTh && (form.kind === "tiered" ? form.tiers.some((t) => t.giftProductSlug) : form.giftProductSlug) && (
                <div className="rounded-xl bg-brand-gradient-soft p-3">
                  <p className="text-[10px] font-bold text-brand-emerald uppercase mb-1">ตัวอย่างที่ลูกค้าจะเห็น</p>
                  <p className="text-xs text-brand-ink">
                    {form.kind === "tiered"
                      ? describeCondition(form)
                      : `${describeCondition(form)} → รับฟรี ${getProductBySlug(form.giftProductSlug)?.name} x${form.giftQty || 1}`}
                  </p>
                </div>
              )}

              {/* advanced (optional) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown size={12} className={showAdvanced ? "rotate-180 transition-transform" : "transition-transform"} />
                  ตั้งค่าขั้นสูง (ไม่จำเป็นต้องกรอก)
                </button>
                {showAdvanced && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">slug (รหัสอ้างอิงภายใน ไม่กรอก = สร้างให้อัตโนมัติ)</label>
                      <input
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                        disabled={Boolean(editingId)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">วันหมดอายุ (ไม่บังคับ)</label>
                      <input
                        type="date"
                        value={form.expires}
                        onChange={(e) => setForm({ ...form, expires: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {formError && <p className="text-xs text-rose-500">{formError}</p>}
              <button
                type="submit"
                disabled={submitting || (form.kind === "tiered" ? !form.tiers.some((t) => t.giftProductSlug) : !form.giftProductSlug)}
                className="w-full rounded-full bg-brand-gradient text-white text-sm font-semibold py-3 disabled:opacity-50"
              >
                {submitting ? "กำลังบันทึก..." : "บันทึกเป็นร่าง (ยังไม่เปิดใช้งาน)"}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                บันทึกแล้วยังไม่มีผลกับลูกค้า ต้องกด &ldquo;เปิดใช้งานจริง&rdquo; ในหน้ารายการอีกครั้ง
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

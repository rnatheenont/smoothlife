"use client";

import { useEffect, useState } from "react";
import { Award, Plus, X, Trash2, Search } from "lucide-react";

type Tier = {
  id: string;
  points_cost: number;
  discount_type: "percent" | "amount";
  discount_value: number;
  label_th: string;
  label_en: string;
  active: boolean;
};

type Customer = { id: string; displayName: string | null; phone: string | null; email: string | null; balance: number };
type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  shopify_order_id: string | null;
  shopify_discount_code: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type TierFormState = { labelTh: string; labelEn: string; pointsCost: string; discountType: "percent" | "amount"; discountValue: string };
const EMPTY_TIER_FORM: TierFormState = { labelTh: "", labelEn: "", pointsCost: "", discountType: "percent", discountValue: "" };

const REASON_LABELS: Record<string, string> = {
  order_paid: "ได้รับจากคำสั่งซื้อ",
  redeem: "แลกแต้ม",
  manual_adjust: "แอดมินปรับแต้ม",
  expire: "แต้มหมดอายุ",
  demo_seed: "แต้มทดลอง",
  order_cancelled: "คืนแต้ม (ยกเลิกคำสั่งซื้อ)",
  refund: "คืนแต้ม (คืนเงิน)",
  checkin_reward: "เช็คอินรายวัน",
  checkin_recovery: "กู้คืนเช็คอิน",
  legacy_verify_bonus: "โบนัสยืนยันบัญชีเก่า",
  review_reward: "รีวิวสินค้า",
  skin_coach_points: "Skin Coach",
  monthly_attendance_reward: "รางวัลเข้าระบบรายเดือน",
  challenge_bonus: "โบนัสภารกิจ",
  birthday_bonus: "โบนัสวันเกิด",
};

function describeReason(reason: string) {
  return REASON_LABELS[reason] ?? reason;
}

export default function AdminPointsPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [showTierForm, setShowTierForm] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [tierForm, setTierForm] = useState<TierFormState>(EMPTY_TIER_FORM);
  const [tierFormError, setTierFormError] = useState("");
  const [tierSubmitting, setTierSubmitting] = useState(false);
  const [tierBusyId, setTierBusyId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const [searched, setSearched] = useState(false);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  async function loadTiers() {
    const res = await fetch("/api/admin/points/tiers");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) setTiers(data.tiers);
  }

  useEffect(() => {
    loadTiers();
  }, []);

  function openCreateTier() {
    setEditingTierId(null);
    setTierForm(EMPTY_TIER_FORM);
    setTierFormError("");
    setShowTierForm(true);
  }

  function startEditTier(t: Tier) {
    setEditingTierId(t.id);
    setTierForm({
      labelTh: t.label_th,
      labelEn: t.label_en,
      pointsCost: String(t.points_cost),
      discountType: t.discount_type,
      discountValue: String(t.discount_value),
    });
    setTierFormError("");
    setShowTierForm(true);
  }

  async function submitTierForm(e: React.FormEvent) {
    e.preventDefault();
    setTierFormError("");
    setTierSubmitting(true);
    try {
      const body = {
        labelTh: tierForm.labelTh,
        labelEn: tierForm.labelEn,
        pointsCost: Number(tierForm.pointsCost),
        discountType: tierForm.discountType,
        discountValue: Number(tierForm.discountValue),
      };
      const url = editingTierId ? `/api/admin/points/tiers/${editingTierId}` : "/api/admin/points/tiers";
      const res = await fetch(url, {
        method: editingTierId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setTierFormError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setShowTierForm(false);
      loadTiers();
    } finally {
      setTierSubmitting(false);
    }
  }

  async function toggleTierActive(t: Tier) {
    setTierBusyId(t.id);
    try {
      await fetch(`/api/admin/points/tiers/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      loadTiers();
    } finally {
      setTierBusyId(null);
    }
  }

  async function deleteTier(id: string) {
    if (!confirm("ลบรายการแลกแต้มนี้? กู้คืนไม่ได้")) return;
    setTierBusyId(id);
    try {
      await fetch(`/api/admin/points/tiers/${id}`, { method: "DELETE" });
      loadTiers();
    } finally {
      setTierBusyId(null);
    }
  }

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/points/customers?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.ok ? data.customers : []);
    } finally {
      setSearching(false);
    }
  }

  async function selectCustomer(c: Customer) {
    setSelected(c);
    setAdjustDelta("");
    setAdjustNote("");
    setAdjustError("");
    const res = await fetch(`/api/admin/points/customers/${c.id}`);
    const data = await res.json();
    if (data.ok) setLedger(data.ledger);
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAdjustError("");
    const delta = Number(adjustDelta);
    if (!Number.isInteger(delta) || delta === 0) {
      setAdjustError("กรุณาระบุจำนวนแต้ม (ใส่เครื่องหมาย - เพื่อหักแต้ม)");
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch("/api/admin/points/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, delta, note: adjustNote || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAdjustError(data.error || "ปรับแต้มไม่สำเร็จ");
        return;
      }
      setSelected({ ...selected, balance: data.balance });
      setResults((prev) => prev.map((c) => (c.id === selected.id ? { ...c, balance: data.balance } : c)));
      setAdjustDelta("");
      setAdjustNote("");
      selectCustomer({ ...selected, balance: data.balance });
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2">
          <Award size={22} className="text-brand-emerald" /> จัดการคะแนน
        </h1>
        <p className="text-sm text-slate-500 mt-1">ตั้งค่ารายการแลกแต้ม และค้นหา/ปรับแต้มสะสมของลูกค้ารายคน</p>
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-brand-ink">รายการแลกแต้ม</h2>
          <button
            onClick={openCreateTier}
            className="flex items-center gap-1 rounded-full bg-brand-gradient text-white text-xs font-semibold px-3 py-1.5"
          >
            <Plus size={13} /> เพิ่มรายการ
          </button>
        </div>
        {tiers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีรายการแลกแต้ม</p>
        ) : (
          <div className="space-y-2.5">
            {tiers.map((t) => (
              <div key={t.id} className="rounded-xl2 border border-slate-100 p-3.5 shadow-card flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-brand-ink">{t.label_th}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t.points_cost.toLocaleString()} แต้ม → {t.discount_type === "percent" ? `ลด ${t.discount_value}%` : `ลด ฿${t.discount_value.toLocaleString()}`}
                  </p>
                </div>
                <button
                  onClick={() => toggleTierActive(t)}
                  disabled={tierBusyId === t.id}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${t.active ? "bg-brand-gradient" : "bg-slate-200"}`}
                  aria-label={t.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${t.active ? "translate-x-[22px]" : "translate-x-0"}`}
                  />
                </button>
                <button onClick={() => startEditTier(t)} className="rounded-full border border-slate-200 text-slate-500 text-xs font-semibold px-3 py-1.5 shrink-0">
                  แก้ไข
                </button>
                <button
                  onClick={() => deleteTier(t.id)}
                  disabled={tierBusyId === t.id}
                  className="rounded-full border border-rose-200 text-rose-500 p-1.5 shrink-0 disabled:opacity-30"
                  aria-label="ลบ"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-bold text-brand-ink mb-3">ค้นหาลูกค้า / ปรับแต้ม</h2>
        <form onSubmit={submitSearch} className="flex gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาด้วยชื่อ, เบอร์โทร, หรืออีเมล"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-1 rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 disabled:opacity-50"
          >
            <Search size={13} /> ค้นหา
          </button>
        </form>

        {searched && !searching && results.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">ไม่พบลูกค้าที่ตรงกับคำค้นหา</p>
        )}

        {results.length > 0 && !selected && (
          <div className="space-y-2 mb-4">
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCustomer(c)}
                className="w-full flex items-center justify-between rounded-xl2 border border-slate-100 p-3 text-left hover:border-brand-teal transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-ink truncate">{c.displayName || "ไม่ระบุชื่อ"}</p>
                  <p className="text-[11px] text-slate-400">{[c.phone, c.email].filter(Boolean).join(" · ") || "-"}</p>
                </div>
                <p className="text-sm font-bold text-brand-emerald shrink-0 ml-3">{c.balance.toLocaleString()} แต้ม</p>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="rounded-xl2 border border-slate-100 p-4 shadow-card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-brand-ink">{selected.displayName || "ไม่ระบุชื่อ"}</p>
                <p className="text-[11px] text-slate-400">{[selected.phone, selected.email].filter(Boolean).join(" · ") || "-"}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="ปิด">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <p className="text-2xl font-extrabold brand-text-gradient mb-4">{selected.balance.toLocaleString()} แต้ม</p>

            <form onSubmit={submitAdjust} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="number"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder="+/- จำนวนแต้ม"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-32"
              />
              <input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="หมายเหตุ (ไม่บังคับ)"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={adjusting}
                className="rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 py-2 disabled:opacity-50 shrink-0"
              >
                {adjusting ? "กำลังบันทึก..." : "ปรับแต้ม"}
              </button>
            </form>
            {adjustError && <p className="text-xs text-rose-500 mb-3">{adjustError}</p>}

            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">ประวัติล่าสุด</p>
            {ledger.length === 0 ? (
              <p className="text-xs text-slate-400">ยังไม่มีประวัติ</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {ledger.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="text-slate-600">{describeReason(entry.reason)}</p>
                      <p className="text-[10px] text-slate-400">{new Date(entry.created_at).toLocaleString("th-TH")}</p>
                    </div>
                    <span className={`font-semibold shrink-0 ml-2 ${entry.delta > 0 ? "text-brand-emerald" : "text-rose-500"}`}>
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {showTierForm && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl2 bg-white p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-brand-ink text-lg">{editingTierId ? "แก้ไขรายการแลกแต้ม" : "เพิ่มรายการแลกแต้ม"}</h2>
              <button onClick={() => setShowTierForm(false)} aria-label="ปิด">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitTierForm} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ชื่อรายการ (ภาษาไทย)</label>
                <input
                  value={tierForm.labelTh}
                  onChange={(e) => setTierForm({ ...tierForm, labelTh: e.target.value })}
                  placeholder="เช่น ส่วนลด 10%"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ชื่อรายการ (ภาษาอังกฤษ)</label>
                <input
                  value={tierForm.labelEn}
                  onChange={(e) => setTierForm({ ...tierForm, labelEn: e.target.value })}
                  placeholder="e.g. 10% off"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">แต้มที่ใช้แลก</label>
                <input
                  type="number"
                  value={tierForm.pointsCost}
                  onChange={(e) => setTierForm({ ...tierForm, pointsCost: e.target.value })}
                  placeholder="เช่น 500"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTierForm({ ...tierForm, discountType: "percent" })}
                  className={`rounded-lg border-2 py-2 text-xs font-semibold ${
                    tierForm.discountType === "percent" ? "border-brand-teal bg-brand-gradient-soft text-brand-emerald" : "border-slate-200 text-slate-500"
                  }`}
                >
                  ลดเป็นเปอร์เซ็นต์
                </button>
                <button
                  type="button"
                  onClick={() => setTierForm({ ...tierForm, discountType: "amount" })}
                  className={`rounded-lg border-2 py-2 text-xs font-semibold ${
                    tierForm.discountType === "amount" ? "border-brand-teal bg-brand-gradient-soft text-brand-emerald" : "border-slate-200 text-slate-500"
                  }`}
                >
                  ลดเป็นจำนวนเงิน
                </button>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  มูลค่าส่วนลด {tierForm.discountType === "percent" ? "(%)" : "(บาท)"}
                </label>
                <input
                  type="number"
                  value={tierForm.discountValue}
                  onChange={(e) => setTierForm({ ...tierForm, discountValue: e.target.value })}
                  placeholder={tierForm.discountType === "percent" ? "เช่น 10" : "เช่น 50"}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              {tierFormError && <p className="text-xs text-rose-500">{tierFormError}</p>}
              <button
                type="submit"
                disabled={tierSubmitting}
                className="w-full rounded-full bg-brand-gradient text-white text-sm font-semibold py-2.5 disabled:opacity-50"
              >
                {tierSubmitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Repeat, Loader2, Bell, BellOff, Sparkles, XCircle } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { formatTHB } from "@/lib/format";
import { subscriptionPlans } from "@/data/subscriptions";
import type { SubscriptionRow, RealSubscriptionRow } from "@/app/api/account/subscriptions/route";

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

const REAL_STATUS_LABEL: Record<RealSubscriptionRow["status"], string> = {
  pending: "รอชำระเงิน",
  active: "ตัดเงินอัตโนมัติ — กำลังใช้งาน",
  past_due: "ตัดเงินไม่สำเร็จ กรุณาตรวจสอบบัตร",
  cancelled: "ยกเลิกแล้ว",
  completed: "ครบรอบแล้ว",
  ended: "สิ้นสุดแล้ว",
};

function RealSubscriptionCard({
  sub,
  onCancelled,
}: {
  sub: RealSubscriptionRow;
  onCancelled: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canCancel = (sub.status === "active" || sub.status === "past_due") && !sub.auto_renew_cancelled;

  async function handleCancel() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/subscribe/${sub.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ยกเลิกไม่สำเร็จ");
        return;
      }
      onCancelled(sub.id);
    } catch {
      setError("ยกเลิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft/40 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                sub.status === "active"
                  ? "bg-brand-gradient text-white"
                  : sub.status === "past_due"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {REAL_STATUS_LABEL[sub.status]}
            </span>
            <span className="text-[10px] text-slate-400">
              เทอมที่ {sub.current_term_number} ({sub.plan_months} เดือน, -{sub.discount_pct}%) · จัดส่งแล้ว{" "}
              {sub.cycles_completed_this_term}/{sub.plan_months} เดือน
            </span>
          </div>
          <Link
            href={sub.subscription_type === "set" ? `/subscription/${sub.set_slug}` : `/product/${sub.product_slug}`}
            className="font-bold text-brand-ink hover:text-brand-emerald"
          >
            {sub.product_name}
          </Link>
          <p className="text-xs text-slate-500 mt-1">
            {formatTHB(sub.amount_per_cycle)} ทุก {sub.plan_months} เดือน (ตัดอัตโนมัติเต็มเทอม)
            {sub.next_charge_date && ` · ตัดครั้งถัดไป ${new Date(sub.next_charge_date).toLocaleDateString("th-TH")}`}
            {sub.next_shipment_date && ` · จัดส่งครั้งถัดไป ${new Date(sub.next_shipment_date).toLocaleDateString("th-TH")}`}
          </p>
          {sub.auto_renew_cancelled && (
            <p className="text-xs font-semibold text-amber-600 mt-1">
              ยกเลิกการต่ออายุแล้ว — จะได้รับสินค้าจนครบเทอมนี้แล้วสิ้นสุด
            </p>
          )}
          {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
        </div>
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={busy}
            className="flex items-center gap-1 shrink-0 rounded-full border border-rose-200 text-rose-500 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <XCircle size={12} />
            {busy ? "กำลังยกเลิก..." : "ยกเลิกการตัดเงิน"}
          </button>
        )}
      </div>
    </div>
  );
}

function SubscriptionsContent() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [realSubscriptions, setRealSubscriptions] = useState<RealSubscriptionRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/subscriptions")
      .then((r) => r.json())
      .then((data) => {
        setSubscriptions(data.subscriptions ?? []);
        setRealSubscriptions(data.realSubscriptions ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(sub: SubscriptionRow) {
    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/account/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !sub.active }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubscriptions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, active: !sub.active } : s)));
      }
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Repeat size={20} className="text-brand-emerald" />
        <h1 className="text-xl font-bold text-brand-ink">การสมัครของฉัน</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        รายการที่คุณสมัคร &ldquo;สมัครรับประจำ&rdquo; ไว้ทั้งหมด
      </p>

      {realSubscriptions.length > 0 && (
        <div className="space-y-3 mb-6">
          {realSubscriptions.map((sub) => (
            <RealSubscriptionCard
              key={sub.id}
              sub={sub}
              onCancelled={(id) =>
                setRealSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, auto_renew_cancelled: true } : s)))
              }
            />
          ))}
        </div>
      )}

      {subscriptions.length === 0 && realSubscriptions.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-slate-200 py-14 text-center">
          <Sparkles size={26} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">ยังไม่มีรายการสมัครรับประจำ</p>
          <p className="text-xs text-slate-400 mt-1">เลือก &ldquo;สมัครรับประจำ&rdquo; ได้จากหน้าสินค้าทุกชิ้น</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const plan = subscriptionPlans.find((p) => p.code === sub.plan_code);
            const remaining = daysUntil(sub.next_renewal_at);
            return (
              <div key={sub.id} className={`rounded-xl2 border p-4 shadow-card ${sub.active ? "border-slate-100" : "border-slate-100 opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          sub.active ? "bg-brand-gradient-soft text-brand-emerald" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {sub.active ? "กำลังติดตาม" : "ปิดการแจ้งเตือนแล้ว"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ทุก {sub.plan_months} เดือน{plan ? ` (-${plan.discountPct}%)` : ""}
                      </span>
                    </div>
                    <Link href={`/product/${sub.product_slug}`} className="font-bold text-brand-ink hover:text-brand-emerald">
                      {sub.product_name}
                    </Link>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatTHB(sub.price_per_cycle)}/ชิ้น · ซื้อเมื่อ {new Date(sub.purchased_at).toLocaleDateString("th-TH")}
                    </p>
                    {sub.active && (
                      <p className="text-xs font-semibold text-brand-emerald mt-1">
                        {remaining > 0 ? `ครบรอบในอีก ${remaining} วัน` : "ครบรอบแล้ว — สั่งซื้อต่อได้เลย"}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(sub)}
                    disabled={busyId === sub.id}
                    className={`flex items-center gap-1 shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                      sub.active ? "border-rose-200 text-rose-500" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {sub.active ? <BellOff size={12} /> : <Bell size={12} />}
                    {sub.active ? "ยกเลิก" : "เปิดแจ้งเตือนอีกครั้ง"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <AccountLayout>
      <SubscriptionsContent />
    </AccountLayout>
  );
}

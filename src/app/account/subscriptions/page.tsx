"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Repeat, Loader2, Bell, BellOff, Sparkles } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { formatTHB } from "@/lib/format";
import { subscriptionPlans } from "@/data/subscriptions";
import type { SubscriptionRow } from "@/app/api/account/subscriptions/route";

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function SubscriptionsContent() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/subscriptions")
      .then((r) => r.json())
      .then((data) => setSubscriptions(data.subscriptions ?? []))
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
        รายการที่คุณสมัคร &ldquo;สมัครรับประจำ&rdquo; ไว้ — ระบบยังไม่ตัดเงินอัตโนมัติ แต่จะเตือนคุณล่วงหน้าก่อนครบรอบ
        เพื่อสั่งซื้อต่อและรับส่วนลดต่อเนื่อง
      </p>

      {subscriptions.length === 0 ? (
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

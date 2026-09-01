"use client";

import { useState, useEffect } from "react";
import { Repeat, AlertTriangle, TrendingUp, Users, Clock, PackageX, RefreshCcw, Undo2 } from "lucide-react";
import { formatTHB } from "@/lib/format";

type NeedsAttentionRow = {
  id: string;
  productName: string;
  amountPerCycle: number;
  contactEmail: string | null;
  contactPhone: string | null;
  nextChargeDate: string | null;
  recurringUniqueId: string | null;
};

type ChargedNoOrderRow = {
  id: string;
  cycleNumber: number;
  amount: number;
  chargedAt: string | null;
  productName: string;
};

type RecentChargeRow = {
  id: string;
  cycleNumber: number;
  amount: number;
  success: boolean | null;
  shopifyOrderId: string | null;
  chargedAt: string | null;
  productName: string;
  subscriptionType: string | null;
  refundedAt: string | null;
  refundNote: string | null;
};

type Overview = {
  byStatus: Record<string, number>;
  mrr: number;
  byType: Record<string, { count: number; mrr: number }>;
  needsAttention: NeedsAttentionRow[];
  chargedNoOrder: ChargedNoOrderRow[];
  recentCharges: RecentChargeRow[];
};

const STATUS_LABEL: Record<string, string> = {
  active: "กำลังใช้งาน",
  past_due: "ตัดเงินไม่ผ่าน",
  pending: "รอชำระเงิน",
  cancelled: "ยกเลิกแล้ว",
  completed: "ครบรอบแล้ว",
  ended: "สิ้นสุดแล้ว",
};

const TYPE_LABEL: Record<string, string> = {
  single_product: "สินค้าเดี่ยว",
  set: "ชุดสำเร็จรูป",
  custom_bundle: "จัดชุดเอง",
};

function StatCard({ icon: Icon, label, value, tone = "default" }: { icon: React.ElementType; label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className="rounded-xl2 border border-slate-100 shadow-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`grid h-8 w-8 place-items-center rounded-full ${
            tone === "warning" ? "bg-amber-100 text-amber-600" : "bg-brand-gradient-soft text-brand-emerald"
          }`}
        >
          <Icon size={16} />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-brand-ink">{value}</p>
    </div>
  );
}

function RefundButton({ chargeId, onDone }: { chargeId: string; onDone: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/subscriptions-overview/mark-refunded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId, note }),
      });
      const data = await res.json();
      if (data.ok) onDone(note);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-rose-500">
        <Undo2 size={11} /> บันทึกคืนเงิน
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุ (ไม่บังคับ)"
        className="w-28 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] outline-none focus:border-brand-teal"
        autoFocus
      />
      <button onClick={submit} disabled={busy} className="text-[10px] font-bold text-brand-emerald disabled:opacity-50">
        {busy ? "..." : "ยืนยัน"}
      </button>
      <button onClick={() => setOpen(false)} className="text-[10px] text-slate-400">
        ยกเลิก
      </button>
    </div>
  );
}

export default function AdminSubscriptionsOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    fetch("/api/admin/subscriptions-overview")
      .then((r) => r.json())
      .then((d) => setData(d.ok ? d : null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function retryOrder(chargeId: string) {
    setRetryingId(chargeId);
    try {
      const res = await fetch("/api/admin/subscriptions-overview/retry-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId }),
      });
      const data = await res.json();
      if (data.ok) {
        setRetryMessage((prev) => ({ ...prev, [chargeId]: `สร้างออเดอร์ ${data.orderName} สำเร็จ` }));
        load();
      } else {
        setRetryMessage((prev) => ({ ...prev, [chargeId]: data.error || "ไม่สำเร็จ" }));
      }
    } finally {
      setRetryingId(null);
    }
  }

  function handleRefunded(chargeId: string, note: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            recentCharges: prev.recentCharges.map((c) =>
              c.id === chargeId ? { ...c, refundedAt: new Date().toISOString(), refundNote: note || null } : c
            ),
          }
        : prev
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-10">กำลังโหลด...</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-400 text-center py-10">โหลดข้อมูลไม่สำเร็จ</p>;
  }

  const active = data.byStatus.active ?? 0;
  const pastDue = data.byStatus.past_due ?? 0;
  const pending = data.byStatus.pending ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2">
          <Repeat size={20} className="text-brand-emerald" /> ภาพรวม Subscription
        </h1>
        <p className="text-sm text-slate-500 mt-1">สรุปการสมัครสมาชิกที่ตัดเงินจริงทั้งหมด</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users} label="กำลังใช้งาน" value={String(active)} />
        <StatCard icon={TrendingUp} label="MRR" value={formatTHB(data.mrr)} />
        <StatCard icon={AlertTriangle} label="ตัดเงินไม่ผ่าน" value={String(pastDue)} tone={pastDue > 0 ? "warning" : "default"} />
        <StatCard icon={Clock} label="รอชำระเงิน" value={String(pending)} />
      </div>

      {data.chargedNoOrder.length > 0 && (
        <div className="rounded-xl2 border border-rose-200 bg-rose-50 p-4 mb-6">
          <h2 className="text-sm font-bold text-rose-700 flex items-center gap-1.5 mb-2">
            <PackageX size={16} /> ตัดเงินสำเร็จแต่ไม่มีออเดอร์ — ต้องเช็คด่วน
          </h2>
          <p className="text-xs text-rose-600 mb-3">
            ลูกค้าถูกตัดเงินไปแล้วแต่ระบบสร้างออเดอร์ใน Shopify ไม่สำเร็จ (อาจเป็นเพราะ Shopify ล่มชั่วคราว) — กด &ldquo;สร้างออเดอร์อีกครั้ง&rdquo; เพื่อลองใหม่ หรือสร้างมือใน Shopify ถ้ายังไม่สำเร็จ
          </p>
          <div className="flex flex-col gap-1.5">
            {data.chargedNoOrder.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 gap-3">
                <span className="text-slate-600 min-w-0">
                  {c.productName} · รอบที่ {c.cycleNumber} · {c.chargedAt ? new Date(c.chargedAt).toLocaleString("th-TH") : "-"}
                  {retryMessage[c.id] && <span className="block text-[10px] text-brand-emerald mt-0.5">{retryMessage[c.id]}</span>}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-rose-600">{formatTHB(c.amount)}</span>
                  <button
                    onClick={() => retryOrder(c.id)}
                    disabled={retryingId === c.id}
                    className="flex items-center gap-1 rounded-full bg-brand-gradient text-white text-[10px] font-semibold px-2.5 py-1 disabled:opacity-50"
                  >
                    <RefreshCcw size={11} className={retryingId === c.id ? "animate-spin" : ""} />
                    สร้างออเดอร์อีกครั้ง
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.needsAttention.length > 0 && (
        <div className="rounded-xl2 border border-amber-200 bg-amber-50 p-4 mb-6">
          <h2 className="text-sm font-bold text-amber-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={16} /> ตัดเงินไม่ผ่าน — รอลูกค้าอัปเดตบัตร
          </h2>
          <div className="flex flex-col gap-1.5">
            {data.needsAttention.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-slate-700 font-semibold truncate">{s.productName}</p>
                  <p className="text-slate-400">{s.contactEmail ?? s.contactPhone ?? "ไม่มีข้อมูลติดต่อ"}</p>
                  {s.recurringUniqueId && (
                    <p className="text-slate-300 text-[10px] mt-0.5">
                      recurring ID (สำหรับยกเลิกมือใน 2C2P portal): {s.recurringUniqueId}
                    </p>
                  )}
                </div>
                <span className="font-bold text-amber-600 shrink-0 ml-2">{formatTHB(s.amountPerCycle)}/เดือน</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl2 border border-slate-100 shadow-card p-4 mb-6">
        <h2 className="text-sm font-bold text-brand-ink mb-3">แบ่งตามประเภท (เฉพาะที่กำลังใช้งาน)</h2>
        {Object.keys(data.byType).length === 0 ? (
          <p className="text-xs text-slate-400">ยังไม่มีการสมัครที่กำลังใช้งาน</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {Object.entries(data.byType).map(([type, v]) => (
              <div key={type} className="rounded-xl bg-surface-soft p-3">
                <p className="text-xs text-slate-500">{TYPE_LABEL[type] ?? type}</p>
                <p className="text-lg font-extrabold text-brand-ink">{v.count} ราย</p>
                <p className="text-xs text-brand-emerald font-semibold">{formatTHB(v.mrr)}/เดือน</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl2 border border-slate-100 shadow-card p-4">
        <h2 className="text-sm font-bold text-brand-ink mb-3">ประวัติการตัดเงินล่าสุด</h2>
        {data.recentCharges.length === 0 ? (
          <p className="text-xs text-slate-400">ยังไม่มีประวัติการตัดเงิน</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3 font-medium">สินค้า</th>
                  <th className="py-2 pr-3 font-medium">ประเภท</th>
                  <th className="py-2 pr-3 font-medium">รอบ</th>
                  <th className="py-2 pr-3 font-medium">ยอด</th>
                  <th className="py-2 pr-3 font-medium">สถานะ</th>
                  <th className="py-2 pr-3 font-medium">เวลา</th>
                  <th className="py-2 pr-3 font-medium">คืนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCharges.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-slate-700">{c.productName}</td>
                    <td className="py-2 pr-3 text-slate-500">{c.subscriptionType ? TYPE_LABEL[c.subscriptionType] ?? c.subscriptionType : "-"}</td>
                    <td className="py-2 pr-3 text-slate-500">{c.cycleNumber}</td>
                    <td className="py-2 pr-3 font-semibold text-slate-700">{formatTHB(c.amount)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          c.success === true
                            ? "bg-brand-gradient-soft text-brand-emerald"
                            : c.success === false
                            ? "bg-rose-100 text-rose-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {c.success === true ? "สำเร็จ" : c.success === false ? "ไม่สำเร็จ" : "รอผล"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{c.chargedAt ? new Date(c.chargedAt).toLocaleString("th-TH") : "-"}</td>
                    <td className="py-2 pr-3">
                      {c.success !== true ? (
                        <span className="text-slate-300">-</span>
                      ) : c.refundedAt ? (
                        <span className="text-[10px] text-rose-500 font-semibold">
                          คืนแล้ว {new Date(c.refundedAt).toLocaleDateString("th-TH")}
                          {c.refundNote && ` · ${c.refundNote}`}
                        </span>
                      ) : (
                        <RefundButton chargeId={c.id} onDone={(note) => handleRefunded(c.id, note)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-6 text-[11px] text-slate-400">
        สรุปสถานะทั้งหมด: {Object.entries(data.byStatus).map(([s, n]) => `${STATUS_LABEL[s] ?? s} ${n}`).join(" · ") || "ไม่มีข้อมูล"}
      </p>
    </div>
  );
}

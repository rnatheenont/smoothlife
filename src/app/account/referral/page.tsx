"use client";

import { useEffect, useState } from "react";
import { Users, Copy, Check, Gift } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";

type ReferralHistoryRow = {
  id: string;
  status: string;
  order_amount: number | null;
  link_clicked_at: string | null;
  delivered_at: string | null;
  reward_release_at: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "รอเพื่อนกดลิงก์", className: "bg-slate-100 text-slate-500" },
  link_clicked: { label: "เพื่อนกดลิงก์แล้ว", className: "bg-brand-gradient-soft text-brand-emerald" },
  registered: { label: "เพื่อนสมัครสมาชิกแล้ว", className: "bg-brand-gradient-soft text-brand-emerald" },
  order_placed: { label: "เพื่อนสั่งซื้อแล้ว รอจัดส่ง", className: "bg-amber-50 text-amber-600" },
  delivered: { label: "จัดส่งสำเร็จ รอปล่อยรางวัล", className: "bg-amber-50 text-amber-600" },
  reward_released: { label: "ได้รับคูปอง ฿100 แล้ว", className: "bg-brand-gradient-soft text-brand-emerald" },
  void: { label: "ไม่ผ่านเงื่อนไข", className: "bg-rose-50 text-rose-500" },
  expired: { label: "หมดอายุ", className: "bg-slate-100 text-slate-400" },
};

function ReferralContent() {
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [eligible, setEligible] = useState(false);
  const [referrals, setReferrals] = useState<ReferralHistoryRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/account/referral");
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "โหลดข้อมูลไม่สำเร็จ");
          return;
        }
        setShareUrl(data.shareUrl);
        setEligible(data.eligible);
        setReferrals(data.referrals || []);
      } catch {
        setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink mb-2 flex items-center gap-2">
        <Users size={22} className="text-brand-emerald" /> แนะนำเพื่อน
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        แชร์ลิงก์ให้เพื่อน เพื่อนได้ส่วนลด ฿100 ในออเดอร์แรก คุณได้คูปอง ฿100 เมื่อเพื่อนสั่งซื้อและจัดส่งสำเร็จ
      </p>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">กำลังโหลด...</p>
      ) : error ? (
        <p className="text-sm text-rose-500 text-center py-10">{error}</p>
      ) : !eligible ? (
        <div className="rounded-xl2 border border-amber-200 bg-amber-50/60 p-5 text-sm text-amber-700">
          ต้องมีคำสั่งซื้อสำเร็จอย่างน้อย 1 ครั้งในช่วง 3 เดือนล่าสุด จึงจะแชร์ลิงก์แนะนำเพื่อนได้ค่ะ
        </div>
      ) : (
        <div className="rounded-xl2 border border-slate-100 p-5 shadow-card mb-8">
          <p className="text-xs text-slate-400 mb-2">ลิงก์แนะนำเพื่อนของคุณ</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl ?? ""}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 bg-slate-50"
            />
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-1 rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 py-2.5"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "คัดลอกแล้ว" : "คัดลอก"}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            เป็นลิงก์เฉพาะตัวคุณ ห้ามแชร์เป็นโค้ดส่วนลดสาธารณะ — ใช้ได้สูงสุด 20 คนต่อปี
          </p>
        </div>
      )}

      <h2 className="font-bold text-brand-ink mb-3 flex items-center gap-1.5">
        <Gift size={16} className="text-brand-emerald" /> ประวัติการแนะนำ
      </h2>
      {referrals.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีประวัติการแนะนำเพื่อน</p>
      ) : (
        <div className="space-y-2.5">
          {referrals.map((r) => {
            const status = STATUS_LABELS[r.status] ?? { label: r.status, className: "bg-slate-100 text-slate-500" };
            return (
              <div key={r.id} className="rounded-xl2 border border-slate-100 p-3.5 shadow-card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("th-TH")}</p>
                  {r.order_amount != null && (
                    <p className="text-xs text-slate-500 mt-0.5">ยอดสั่งซื้อของเพื่อน ฿{r.order_amount.toLocaleString()}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full text-[11px] font-semibold px-2.5 py-1 ${status.className}`}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReferralPage() {
  return (
    <AccountLayout>
      <ReferralContent />
    </AccountLayout>
  );
}

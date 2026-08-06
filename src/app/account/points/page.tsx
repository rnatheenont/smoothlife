"use client";

import { useEffect, useState } from "react";
import { Award, Gift, Star, Crown, History } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AccountGate from "@/components/AccountGate";
import DemoBadge from "@/components/DemoBadge";

const tiers = [
  { name: "Bronze", min: 0, icon: Star, perks: ["สะสมคะแนน 1 บาท = 1 คะแนน", "ส่วนลดวันเกิด 10%"] },
  { name: "Silver", min: 1000, icon: Award, perks: ["ส่งฟรีทุกออเดอร์", "เข้าถึงดีลพิเศษก่อนใคร"] },
  { name: "Gold", min: 3000, icon: Crown, perks: ["สะสมคะแนน 1 บาท = 1.5 คะแนน", "ปรึกษาผู้เชี่ยวชาญส่วนตัว"] },
];

const reasonLabel: Record<string, string> = {
  order_paid: "ได้รับจากคำสั่งซื้อ",
  redeem: "แลกใช้คะแนน",
  manual_adjust: "ปรับคะแนนโดยระบบ",
  expire: "คะแนนหมดอายุ",
  demo_seed: "ข้อมูลทดสอบ",
};

type LedgerEntry = { id: string; delta: number; reason: string; created_at: string };

function PointsContent() {
  const { user } = useAuth();
  const isReal = user?.provider === "email";
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);

  useEffect(() => {
    if (!isReal) return;
    fetch("/api/auth/points")
      .then((r) => r.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => setEntries([]));
  }, [isReal]);

  if (!user) return null;

  return (
    <div className="container-page py-8 md:py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-ink mb-2">คะแนนสะสมและระดับสมาชิก</h1>
      <p className="text-sm text-slate-500 mb-4">Smooth Life Rewards — ยิ่งช้อป ยิ่งได้สิทธิพิเศษมากขึ้น</p>
      {!isReal && (
        <div className="mb-6">
          <DemoBadge text="คะแนนที่แสดงตอนนี้เป็นข้อมูลทดสอบในเบราว์เซอร์นี้เท่านั้น (เข้าสู่ระบบด้วย Email เพื่อใช้บัญชีคะแนนจริงที่บันทึกลงฐานข้อมูล) คะแนนจากคำสั่งซื้อจริงจะเริ่มบันทึกอัตโนมัติเมื่อเชื่อม Shopify webhook ในเฟสถัดไป" />
        </div>
      )}

      <div className="rounded-xl2 bg-brand-gradient text-white p-6 flex items-center justify-between mb-8">
        <div>
          <p className="text-xs text-white/80">คะแนนสะสมของคุณ</p>
          <p className="text-3xl font-bold">{user.points} pts</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/80">ระดับสมาชิกปัจจุบัน</p>
          <p className="text-xl font-bold">{user.tier}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {tiers.map((t) => {
          const active = user.tier === t.name;
          return (
            <div
              key={t.name}
              className={`rounded-xl2 border p-5 ${active ? "border-brand-teal bg-brand-gradient-soft" : "border-slate-100"}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`grid h-9 w-9 place-items-center rounded-full ${active ? "bg-brand-gradient text-white" : "bg-surface-muted text-slate-400"}`}>
                  <t.icon size={16} />
                </div>
                <div>
                  <p className="font-bold text-brand-ink">{t.name}</p>
                  <p className="text-xs text-slate-400">ตั้งแต่ {t.min.toLocaleString()} คะแนนขึ้นไป</p>
                </div>
                {active && <span className="ml-auto text-xs font-bold text-brand-emerald">ระดับปัจจุบัน</span>}
              </div>
              <ul className="text-sm text-slate-600 flex flex-col gap-1 pl-12">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <Gift size={12} className="text-brand-emerald" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {isReal && (
        <div className="mt-8">
          <h2 className="font-bold text-brand-ink flex items-center gap-2 mb-3">
            <History size={16} className="text-brand-emerald" /> ประวัติคะแนน
          </h2>
          {entries === null ? (
            <p className="text-sm text-slate-400">กำลังโหลด...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีประวัติคะแนน</p>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-brand-ink">{reasonLabel[e.reason] || e.reason}</p>
                    <p className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString("th-TH")}</p>
                  </div>
                  <span className={`font-bold ${e.delta >= 0 ? "text-brand-emerald" : "text-rose-500"}`}>
                    {e.delta >= 0 ? "+" : ""}
                    {e.delta.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PointsPage() {
  return (
    <AccountGate>
      <PointsContent />
    </AccountGate>
  );
}

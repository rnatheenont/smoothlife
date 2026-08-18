"use client";

import { useEffect, useState } from "react";
import { Award, Gift, Star, Crown, History, Ticket, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import AccountLayout from "@/components/account/AccountLayout";
import DemoBadge from "@/components/DemoBadge";
import type { RedemptionTier } from "@/app/api/account/redeem/route";

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
  checkin_reward: "รางวัลเช็กอินรายวัน",
  checkin_recovery: "กู้คืนวันที่พลาด",
  legacy_verify_bonus: "โบนัสสมาชิกเดิม",
  review_reward: "รีวิวสินค้า",
  skin_coach_points: "รางวัล Skin Coach",
  monthly_attendance_reward: "เช็กอินครบทุกวันของเดือน",
  challenge_bonus: "โบนัส 7-Day Challenge",
};

type LedgerEntry = { id: string; delta: number; reason: string; created_at: string };

function PointsContent() {
  const { user, refreshUser } = useAuth();
  const { setCouponCode } = useCart();
  const isReal = user?.real;
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [tiersList, setTiersList] = useState<RedemptionTier[] | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<{ code: string; tier: RedemptionTier } | null>(null);

  function loadEntries() {
    fetch("/api/auth/points")
      .then((r) => r.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => setEntries([]));
  }

  useEffect(() => {
    if (!isReal) return;
    loadEntries();
    fetch("/api/account/redeem")
      .then((r) => r.json())
      .then((data) => setTiersList(data.tiers || []))
      .catch(() => setTiersList([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReal]);

  async function redeem(tier: RedemptionTier) {
    setRedeemingId(tier.id);
    setRedeemError(null);
    try {
      const res = await fetch("/api/account/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: tier.id }),
      });
      const data = await res.json();
      if (!data.ok) {
        setRedeemError(data.error || "แลกแต้มไม่สำเร็จค่ะ");
        return;
      }
      setRedeemed({ code: data.code, tier });
      // Applied straight to the cart too, not just shown here — otherwise
      // the customer has to notice, remember, and manually retype this
      // exact code once they reach Shopify's checkout.
      setCouponCode(data.code);
      loadEntries();
      await refreshUser();
    } catch {
      setRedeemError("แลกแต้มไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ");
    } finally {
      setRedeemingId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl">
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

      {isReal && tiersList && tiersList.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold text-brand-ink flex items-center gap-2 mb-3">
            <Ticket size={16} className="text-brand-emerald" /> แลกแต้มเป็นส่วนลด
          </h2>
          {redeemError && <p className="text-sm text-rose-500 mb-3">{redeemError}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {tiersList.map((t) => {
              const canAfford = user.points >= t.points_cost;
              return (
                <div key={t.id} className="rounded-xl2 border border-slate-100 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-brand-ink text-sm">{t.label_th}</p>
                    <p className="text-xs text-slate-400">{t.points_cost.toLocaleString()} แต้ม</p>
                  </div>
                  <button
                    onClick={() => redeem(t)}
                    disabled={!canAfford || redeemingId === t.id}
                    className="shrink-0 rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 py-2 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {redeemingId === t.id ? <Loader2 size={13} className="animate-spin" /> : canAfford ? "แลกเลย" : "แต้มไม่พอ"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {redeemed && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald">
              <CheckCircle2 size={28} />
            </div>
            <p className="text-lg font-bold text-brand-ink mb-1">แลกแต้มสำเร็จ!</p>
            <p className="text-sm text-slate-600 mb-4">{redeemed.tier.label_th}</p>
            <div className="mb-4 rounded-xl border border-dashed border-brand-teal bg-brand-gradient-soft px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">โค้ดส่วนลดของคุณ (ใส่ในตะกร้าให้แล้ว)</p>
              <p className="font-mono text-lg font-bold text-brand-emerald">{redeemed.code}</p>
            </div>
            <button
              onClick={() => setRedeemed(null)}
              className="w-full rounded-full bg-brand-gradient text-white font-semibold py-2.5 text-sm"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PointsPage() {
  return (
    <AccountLayout>
      <PointsContent />
    </AccountLayout>
  );
}

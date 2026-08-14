"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Copy, Check, Loader2, Award } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { discountForScore, SKIN_COACH_POINTS_REWARD } from "@/lib/skin-coach";

export default function RewardClaim({ score }: { score: number }) {
  const { user, refreshUser } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [label, setLabel] = useState(discountForScore(score).label);
  const [busy, setBusy] = useState<"coupon" | "points" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function claim(method: "coupon" | "points") {
    setBusy(method);
    setError(null);
    try {
      const res = await fetch("/api/skin-coach/claim-reward", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score, method }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ขออภัยค่ะ รับรางวัลไม่สำเร็จ");
        return;
      }
      if (data.rewardType === "points") {
        setPointsAwarded(data.points ?? SKIN_COACH_POINTS_REWARD);
        refreshUser();
      } else {
        setCode(data.code);
      }
      if (data.label) setLabel(data.label);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!user || !user.real) {
    return (
      <div className="rounded-xl2 border border-amber-200 bg-amber-50/60 p-5 text-center">
        <Gift size={20} className="mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-brand-ink font-semibold mb-1">เข้าสู่ระบบเพื่อรับคูปองส่วนลด</p>
        <p className="text-xs text-slate-500 mb-3">ทำกิจกรรมสแกนผิวครบแล้ว รับส่วนลดได้ทันทีหลังเข้าสู่ระบบ</p>
        <Link
          href="/account/login?returnTo=/skin-coach"
          className="inline-block rounded-full bg-brand-gradient text-white font-semibold px-5 py-2.5 text-xs"
        >
          เข้าสู่ระบบ / สมัครสมาชิก
        </Link>
      </div>
    );
  }

  if (code) {
    return (
      <div className="rounded-xl2 border border-brand-teal bg-brand-gradient-soft p-5 text-center">
        <Gift size={20} className="mx-auto text-brand-emerald mb-2" />
        <p className="text-sm text-brand-ink font-semibold mb-3">รับส่วนลด {label} เรียบร้อย!</p>
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-teal px-5 py-2.5 font-mono text-sm font-bold text-brand-ink"
        >
          {code}
          {copied ? <Check size={14} className="text-brand-emerald" /> : <Copy size={14} className="text-slate-400" />}
        </button>
        <p className="text-[11px] text-slate-500 mt-3">ใช้ได้ 1 ครั้งตอนชำระเงิน • สิทธิ์ 1 คูปองต่อบัญชีต่อเดือน</p>
      </div>
    );
  }

  if (pointsAwarded !== null) {
    return (
      <div className="rounded-xl2 border border-brand-teal bg-brand-gradient-soft p-5 text-center">
        <Award size={20} className="mx-auto text-brand-emerald mb-2" />
        <p className="text-sm text-brand-ink font-semibold mb-1">ได้รับ {pointsAwarded} คะแนนเรียบร้อย!</p>
        <Link href="/account/points" className="text-xs font-semibold text-brand-emerald underline">
          ดูคะแนนสะสม
        </Link>
        <p className="text-[11px] text-slate-500 mt-3">สิทธิ์ 1 ครั้งต่อบัญชีต่อเดือน</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 border border-amber-200 bg-amber-50/60 p-5 text-center">
      <Gift size={20} className="mx-auto text-amber-500 mb-2" />
      <p className="text-sm text-brand-ink font-semibold mb-1">ทำกิจกรรมสแกนผิวครบแล้ว!</p>
      <p className="text-xs text-slate-500 mb-3">เลือกรับส่วนลด {label} หรือคะแนนสะสม สำหรับคำสั่งซื้อถัดไป</p>
      {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
        <button
          disabled={busy !== null}
          onClick={() => claim("coupon")}
          className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm disabled:opacity-60"
        >
          {busy === "coupon" && <Loader2 size={14} className="animate-spin" />}
          {busy === "coupon" ? "กำลังออกคูปอง..." : `รับคูปองส่วนลด ${label}`}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => claim("points")}
          className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-teal text-brand-ink font-semibold px-6 py-3 text-sm disabled:opacity-60"
        >
          {busy === "points" && <Loader2 size={14} className="animate-spin" />}
          {busy === "points" ? "กำลังบันทึกคะแนน..." : `รับ ${SKIN_COACH_POINTS_REWARD} คะแนนแทน`}
        </button>
      </div>
    </div>
  );
}

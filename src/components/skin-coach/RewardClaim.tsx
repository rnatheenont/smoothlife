"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Copy, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { discountForScore } from "@/lib/skin-coach";

export default function RewardClaim({ score }: { score: number }) {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [label, setLabel] = useState(discountForScore(score).label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/skin-coach/claim-reward", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ขออภัยค่ะ รับคูปองไม่สำเร็จ");
        return;
      }
      setCode(data.code);
      if (data.label) setLabel(data.label);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
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

  return (
    <div className="rounded-xl2 border border-amber-200 bg-amber-50/60 p-5 text-center">
      <Gift size={20} className="mx-auto text-amber-500 mb-2" />
      <p className="text-sm text-brand-ink font-semibold mb-1">ทำกิจกรรมสแกนผิวครบแล้ว!</p>
      <p className="text-xs text-slate-500 mb-3">รับส่วนลด {label} สำหรับคำสั่งซื้อถัดไป ตามผลสแกนผิวของคุณ</p>
      {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
      <button
        disabled={busy}
        onClick={claim}
        className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm disabled:opacity-60"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {busy ? "กำลังออกคูปอง..." : "รับคูปองส่วนลด"}
      </button>
    </div>
  );
}

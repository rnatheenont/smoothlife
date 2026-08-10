"use client";

import { useState } from "react";
import { ShieldCheck, Loader2, Copy, Check } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/lib/auth-context";
import DemoBadge from "@/components/DemoBadge";

function ChangePasswordContent() {
  const { user } = useAuth();
  const isReal = user?.provider === "email";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function requestReset() {
    setBusy(true);
    setError(null);
    setDevLink(null);
    const res = await fetch("/api/auth/change-password/request", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "ส่งคำขอไม่สำเร็จ");
      return;
    }
    setDevLink(data.devResetLink);
  }

  function copyLink() {
    if (!devLink) return;
    navigator.clipboard.writeText(window.location.origin + devLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-md">
      <div className="rounded-xl2 border border-slate-100 shadow-card p-6 md:p-8">
        <div className="flex items-center gap-2 text-brand-emerald mb-4">
          <ShieldCheck size={20} />
          <span className="text-sm font-semibold">เปลี่ยนรหัสผ่าน</span>
        </div>
        <p className="text-sm text-slate-600 mb-1">
          เพื่อความปลอดภัย เราต้องยืนยันตัวตนของคุณก่อนเปลี่ยนรหัสผ่าน เราจะส่งรหัสยืนยันไปยังอีเมลที่ลงทะเบียนไว้
        </p>
        {isReal && user?.email && (
          <p className="text-sm font-semibold text-brand-ink mb-6">อีเมลที่ลงทะเบียน: {user.email}</p>
        )}

        {!isReal && (
          <div className="my-4">
            <DemoBadge text="เปลี่ยนรหัสผ่านได้เฉพาะบัญชีที่เข้าสู่ระบบด้วย Email เท่านั้น" />
          </div>
        )}

        {isReal && !devLink && (
          <>
            {error && <p className="text-sm text-rose-500 mb-3">{error}</p>}
            <button
              disabled={busy}
              onClick={requestReset}
              className="w-full rounded-full bg-brand-ink text-white font-semibold px-6 py-3 text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              ส่งรหัสยืนยัน
            </button>
          </>
        )}

        {devLink && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              ยังไม่ได้ตั้งค่าระบบส่งอีเมลจริงในโปรเจกต์นี้ — ระหว่างนี้ใช้ลิงก์นี้แทนอีเมลได้เลย (dev mode)
            </p>
            <button
              onClick={copyLink}
              className="flex w-full items-center justify-between gap-2 rounded-lg bg-white border border-amber-200 px-3.5 py-2.5 text-left text-xs font-mono text-slate-600 break-all"
            >
              <span className="truncate">{devLink}</span>
              {copied ? <Check size={14} className="text-brand-emerald shrink-0" /> : <Copy size={14} className="text-slate-400 shrink-0" />}
            </button>
            <a
              href={devLink}
              className="mt-3 block text-center rounded-full bg-brand-gradient text-white font-semibold px-6 py-2.5 text-xs"
            >
              ไปตั้งรหัสผ่านใหม่
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <AccountLayout>
      <ChangePasswordContent />
    </AccountLayout>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, Copy, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setDevLink(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "ส่งคำขอไม่สำเร็จ");
      return;
    }
    setMessage(data.message);
    if (data.devResetLink) setDevLink(data.devResetLink);
  }

  function copyLink() {
    if (!devLink) return;
    navigator.clipboard.writeText(window.location.origin + devLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="container-page py-16 max-w-sm mx-auto">
      <div className="rounded-xl2 border border-slate-100 shadow-card p-6 md:p-8 text-center">
        <div className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-4">
          <KeyRound size={22} />
        </div>
        <h1 className="text-xl font-bold text-brand-ink mb-1">ลืมรหัสผ่าน?</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้</p>

        {!message ? (
          <form onSubmit={submit} className="flex flex-col gap-3 text-left">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal"
            />
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <button
              disabled={busy}
              className="rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              ส่งลิงก์ตั้งรหัสผ่านใหม่
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-brand-emerald bg-brand-gradient-soft rounded-lg px-3.5 py-3">{message}</p>
            {devLink && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-left">
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
        )}

        <Link href="/account/login" className="inline-block mt-6 text-xs text-slate-400">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}

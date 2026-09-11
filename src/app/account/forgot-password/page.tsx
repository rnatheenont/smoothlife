"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SHOPIFY_EMAIL_LOGIN, shopifyAuthStartPath } from "@/lib/shopify-email-login";
import { KeyRound, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui";

const RETURN_ERRORS: Record<string, string> = {
  shopify_no_account: "ยังไม่มีบัญชีที่ใช้อีเมลนี้ เข้าสู่ระบบด้วยอีเมลนี้เพื่อสมัครใหม่ได้เลย",
  shopify_denied: "ยกเลิกการยืนยันอีเมลแล้ว",
  shopify_state_mismatch: "หมดเวลายืนยัน กรุณาลองใหม่อีกครั้ง",
  shopify_error: "ยืนยันอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

function ForgotPasswordContent() {
  const returnError = useSearchParams().get("error");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Shopify emails the code; its callback lands on the set-new-password
    // form once the inbox is confirmed.
    if (SHOPIFY_EMAIL_LOGIN) {
      window.location.href = shopifyAuthStartPath({ intent: "reset", hint: email.trim() });
      return;
    }
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
        <div className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-brand-gradient-soft text-brand-800 mb-4">
          <KeyRound size={22} />
        </div>
        <h1 className="text-xl font-bold text-brand-ink mb-1">ลืมรหัสผ่าน?</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">
          {SHOPIFY_EMAIL_LOGIN
            ? "กรอกอีเมลที่ใช้สมัคร แล้วยืนยันด้วยรหัสที่ส่งไปทางอีเมล จากนั้นตั้งรหัสผ่านใหม่ได้ทันที"
            : "กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้"}
        </p>
        {returnError && RETURN_ERRORS[returnError] && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-left text-xs text-amber-800">{RETURN_ERRORS[returnError]}</p>
        )}

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
            {error && <p className="text-xs text-rose-700">{error}</p>}
            <Button type="submit" size="lg" disabled={busy}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              {SHOPIFY_EMAIL_LOGIN ? "รับรหัสยืนยันทางอีเมล" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-brand-800 bg-brand-gradient-soft rounded-lg px-3.5 py-3">{message}</p>
            {devLink && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-left">
                <p className="text-xs font-semibold text-amber-800 mb-2">
                  ยังไม่ได้ตั้งค่าระบบส่งอีเมลจริงในโปรเจกต์นี้ — ระหว่างนี้ใช้ลิงก์นี้แทนอีเมลได้เลย (dev mode)
                </p>
                <button
                  onClick={copyLink}
                  aria-label={copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
                  className="flex w-full items-center justify-between gap-2 rounded-lg bg-white border border-amber-200 px-3.5 py-2.5 text-left text-xs font-mono text-slate-600 break-all"
                >
                  <span className="truncate">{devLink}</span>
                  {copied ? <Check size={14} className="text-brand-emerald shrink-0" /> : <Copy size={14} className="text-slate-400 shrink-0" />}
                </button>
                <Button
                  href={devLink}
                  size="none"
                  fullWidth
                  className="mt-3 px-6 py-2.5 text-xs"
                >
                  ไปตั้งรหัสผ่านใหม่
                </Button>
              </div>
            )}
          </div>
        )}

        <Link href="/account/login" className="inline-block mt-6 text-xs text-slate-500">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary on a statically rendered page.
export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/change-password/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "เกิดข้อผิดพลาด");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/account/login"), 2000);
  }

  return (
    <div className="container-page py-16 max-w-sm mx-auto">
      <div className="rounded-xl2 border border-slate-100 shadow-card p-6 md:p-8 text-center">
        <div className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-4">
          <ShieldCheck size={22} />
        </div>
        <h1 className="text-xl font-bold text-brand-ink mb-1">ตั้งรหัสผ่านใหม่</h1>

        {!token && <p className="text-sm text-rose-500 mt-4">ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากหน้าบัญชีของคุณ</p>}

        {token && done && <p className="text-sm text-brand-emerald mt-4">เปลี่ยนรหัสผ่านสำเร็จ กำลังพาไปหน้าเข้าสู่ระบบ...</p>}

        {token && !done && (
          <form onSubmit={submit} className="flex flex-col gap-3 mt-5 text-left">
            <div className="relative">
              <input
                required
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                minLength={6}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 pr-10 text-sm outline-none focus:border-brand-teal"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <input
              required
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="ยืนยันรหัสผ่านใหม่"
              minLength={6}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal"
            />
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <button
              disabled={busy}
              className="rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              บันทึกรหัสผ่านใหม่
            </button>
          </form>
        )}

        <Link href="/account" className="inline-block mt-6 text-xs text-slate-400">
          กลับไปหน้าบัญชี
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-slate-400">กำลังโหลด...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

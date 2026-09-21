"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { PASSWORD_REQUIREMENT_TH } from "@/lib/password-policy";

// Where the emailed link lands. Rendered outside the admin gate (see
// layout.tsx) — the reason someone is here is that they cannot get in.
function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setError(data?.error || "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
        return;
      }
      setDone(true);
    } catch {
      setError("ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <p className="text-center text-sm text-slate-500">
        ลิงก์ไม่ครบถ้วน กรุณาเปิดจากลิงก์ในอีเมลอีกครั้ง หรือ{" "}
        <Link href="/admin" className="font-semibold text-brand-800 hover:underline">
          ขอลิงก์ใหม่
        </Link>
      </p>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-sm text-brand-ink">ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว</p>
        <Link href="/admin" className="mt-4 inline-block">
          <Button type="button">เข้าสู่ระบบ</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="admin-new-password" className="mb-1.5 block text-sm font-semibold text-brand-ink">
          รหัสผ่านใหม่
        </label>
        <input
          id="admin-new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-hidden focus:border-brand-teal"
          autoFocus
        />
        <p className="mt-1 text-xs text-slate-400">{PASSWORD_REQUIREMENT_TH}</p>
      </div>
      <div>
        <label htmlFor="admin-confirm-password" className="mb-1.5 block text-sm font-semibold text-brand-ink">
          ยืนยันรหัสผ่านใหม่
        </label>
        <input
          id="admin-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-hidden focus:border-brand-teal"
        />
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <Button fullWidth type="submit" disabled={saving}>
        {saving ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
      </Button>
    </form>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card ring-1 ring-surface-line md:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-gradient-soft">
            <Lock size={20} className="text-brand-emerald" />
          </div>
          <h1 className="text-lg font-bold text-brand-ink">ตั้งรหัสผ่านแอดมินใหม่</h1>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-slate-400">กำลังโหลด…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}

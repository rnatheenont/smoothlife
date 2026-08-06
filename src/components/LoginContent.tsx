"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, MessageCircle, Lock, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import DemoBadge from "./DemoBadge";
import LineLoginModal from "./LineLoginModal";

type Tab = "otp" | "email" | "line";

export default function LoginContent() {
  const [tab, setTab] = useState<Tab>("otp");
  const [mode, setMode] = useState<"login" | "register">("login");
  const { registerWithEmail, loginWithEmail, requestOtp, verifyOtp, loginWithLine } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";

  // Email state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");

  // OTP state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [expectedOtp, setExpectedOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpName, setOtpName] = useState("");

  const [lineOpen, setLineOpen] = useState(false);

  const [emailSubmitting, setEmailSubmitting] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setEmailSubmitting(true);
    const result =
      mode === "register" ? await registerWithEmail(name, email, password) : await loginWithEmail(email, password);
    setEmailSubmitting(false);
    if (!result.ok) setEmailError(result.error || "เกิดข้อผิดพลาด");
    else router.push(returnTo);
  }

  function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim().length < 9) return;
    const code = requestOtp(phone);
    setExpectedOtp(code);
    setOtpSent(true);
    setOtpError("");
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const result = verifyOtp(phone, otpInput, expectedOtp, otpName || undefined);
    if (!result.ok) setOtpError(result.error || "เกิดข้อผิดพลาด");
    else router.push(returnTo);
  }

  function handleLineConfirm(displayName: string) {
    loginWithLine(displayName);
    setLineOpen(false);
    router.push(returnTo);
  }

  return (
    <div className="container-page py-10 md:py-16 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-brand-ink">เข้าสู่ระบบ Smoothlife.com</h1>
        <p className="text-sm text-slate-500 mt-1">เข้าสู่ระบบเพื่อสะสมคะแนนและติดตามคำสั่งซื้อ</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-full bg-surface-soft p-1.5 mb-6">
        {[
          { id: "otp" as Tab, label: "OTP เบอร์โทร", icon: Phone },
          { id: "line" as Tab, label: "LINE", icon: MessageCircle },
          { id: "email" as Tab, label: "Email", icon: Mail },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs md:text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-white shadow-card text-brand-ink" : "text-slate-500"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "otp" && (
        <div className="flex flex-col gap-4">
          <DemoBadge text="Demo Mode: ระบบยังไม่เชื่อมต่อผู้ให้บริการ SMS จริง รหัส OTP จะแสดงบนหน้าจอเพื่อการทดสอบ" />
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-slate-500">เบอร์โทรศัพท์</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal"
              />
              <button className="rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity">
                ส่งรหัส OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
              <div className="rounded-lg bg-brand-gradient-soft p-3 text-center">
                <p className="text-xs text-slate-500">รหัส OTP ของคุณ (จำลองการส่ง SMS)</p>
                <p className="text-2xl font-bold tracking-widest text-brand-emerald">{expectedOtp}</p>
              </div>
              <input
                value={otpName}
                onChange={(e) => setOtpName(e.target.value)}
                placeholder="ชื่อของคุณ (สำหรับสมาชิกใหม่)"
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal"
              />
              <input
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="กรอกรหัส OTP 6 หลัก"
                maxLength={6}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal tracking-widest text-center"
              />
              {otpError && <p className="text-xs text-rose-500">{otpError}</p>}
              <button className="rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity">
                ยืนยันรหัส OTP
              </button>
              <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-slate-400">
                เปลี่ยนเบอร์โทรศัพท์
              </button>
            </form>
          )}
        </div>
      )}

      {tab === "line" && (
        <div className="flex flex-col gap-4">
          <DemoBadge text="Demo Mode: จำลองหน้าจอ LINE Login สำหรับต้นแบบ ระบบจริงต้องเชื่อมต่อ LINE Login Channel (LIFF)" />
          <button
            onClick={() => setLineOpen(true)}
            className="flex items-center justify-center gap-2 rounded-full bg-[#06C755] text-white font-semibold py-3 text-sm"
          >
            <MessageCircle size={18} /> เข้าสู่ระบบด้วย LINE
          </button>
        </div>
      )}

      {tab === "email" && (
        <div className="flex flex-col gap-4">
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            {mode === "register" && (
              <div className="relative">
                <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-3 text-sm outline-none focus:border-brand-teal"
                />
              </div>
            )}
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-3 text-sm outline-none focus:border-brand-teal"
              />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
                minLength={6}
                className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-3 text-sm outline-none focus:border-brand-teal"
              />
            </div>
            {emailError && <p className="text-xs text-rose-500">{emailError}</p>}
            <button
              disabled={emailSubmitting}
              className="rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {emailSubmitting ? "กำลังดำเนินการ..." : mode === "register" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
            </button>
          </form>
          <button
            onClick={() => setMode(mode === "register" ? "login" : "register")}
            className="text-xs text-center text-slate-500"
          >
            {mode === "register" ? "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครสมาชิก"}
          </button>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mt-8">
        การเข้าสู่ระบบถือว่าคุณยอมรับ{" "}
        <Link href="/help" className="underline">
          ข้อกำหนดการใช้บริการ
        </Link>{" "}
        ของ Smoothlife.com
      </p>

      <LineLoginModal open={lineOpen} onClose={() => setLineOpen(false)} onConfirm={handleLineConfirm} />
    </div>
  );
}

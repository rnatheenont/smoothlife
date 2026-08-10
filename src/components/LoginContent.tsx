"use client";

import { useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, MessageCircle, Lock, User as UserIcon, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { firebaseConfigured, getFirebaseAuth, toE164Thai } from "@/lib/firebase-client";
import DemoBadge from "./DemoBadge";

type Tab = "otp" | "email" | "line";

const LINE_ERRORS: Record<string, string> = {
  line_not_configured: "ระบบ LINE Login ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ",
  line_denied: "คุณยกเลิกการเข้าสู่ระบบด้วย LINE",
  line_state_mismatch: "เซสชันหมดอายุ กรุณาลองเข้าสู่ระบบด้วย LINE อีกครั้ง",
  line_error: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

export default function LoginContent() {
  const [tab, setTab] = useState<Tab>("otp");
  const [mode, setMode] = useState<"login" | "register">("login");
  const { registerWithEmail, loginWithEmail, completePhoneLogin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";
  const lineError = searchParams.get("error");

  // Email state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailMethod, setEmailMethod] = useState<"otp" | "password">("otp");

  // Email OTP state
  const [emailOtpAddress, setEmailOtpAddress] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailOtpName, setEmailOtpName] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [emailOtpDevCode, setEmailOtpDevCode] = useState("");

  // OTP state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpName, setOtpName] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  // grecaptcha remembers it already rendered a widget on a given DOM node
  // even after verifier.clear() — bumping this key forces React to mount a
  // brand-new #recaptcha-container element on retry instead of reusing one
  // grecaptcha considers "already rendered".
  const [recaptchaKey, setRecaptchaKey] = useState(0);

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

  async function handleSendEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOtpAddress.trim()) return;
    setEmailOtpError("");
    setEmailOtpDevCode("");
    setEmailOtpSending(true);
    try {
      const res = await fetch("/api/auth/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailOtpAddress.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setEmailOtpError(data.error || "ส่งรหัสไม่สำเร็จ");
        return;
      }
      if (!data.emailSent && data.devCode) setEmailOtpDevCode(data.devCode);
      setEmailOtpSent(true);
    } catch (err) {
      console.error("[email-otp] send failed", err);
      setEmailOtpError("ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setEmailOtpSending(false);
    }
  }

  async function handleVerifyEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    setEmailOtpError("");
    setEmailOtpVerifying(true);
    try {
      const res = await fetch("/api/auth/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailOtpAddress.trim(), code: emailOtpCode.trim(), name: emailOtpName || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        setEmailOtpError(data.error || "ยืนยันไม่สำเร็จ");
        return;
      }
      completePhoneLogin(data.user);
      router.push(returnTo);
    } catch (err) {
      console.error("[email-otp] verify failed", err);
      setEmailOtpError("รหัสไม่ถูกต้อง กรุณาลองใหม่");
    } finally {
      setEmailOtpVerifying(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim().length < 9) return;
    setOtpError("");
    setOtpSending(true);
    try {
      const auth = getFirebaseAuth();
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      const confirmation = await signInWithPhoneNumber(auth, toE164Thai(phone), recaptchaVerifierRef.current);
      confirmationResultRef.current = confirmation;
      setOtpSent(true);
    } catch (err) {
      console.error("[otp] send failed", err);
      setOtpError("ส่งรหัส OTP ไม่สำเร็จ กรุณาตรวจสอบเบอร์โทรศัพท์แล้วลองใหม่อีกครั้ง");
      // A failed attempt can leave the reCAPTCHA widget in a used state —
      // drop it AND mount a fresh container node (see recaptchaKey comment)
      // so the next try renders cleanly instead of hitting
      // "reCAPTCHA has already been rendered in this element".
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      setRecaptchaKey((k) => k + 1);
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmationResultRef.current) return;
    setOtpError("");
    setOtpVerifying(true);
    try {
      const credential = await confirmationResultRef.current.confirm(otpInput);
      const idToken = await credential.user.getIdToken();
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, name: otpName || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        setOtpError(data.error || "ยืนยันไม่สำเร็จ");
        return;
      }
      completePhoneLogin(data.user);
      router.push(returnTo);
    } catch (err) {
      console.error("[otp] verify failed", err);
      setOtpError("รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่");
    } finally {
      setOtpVerifying(false);
    }
  }

  return (
    <div className="container-page py-10 md:py-16 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-brand-ink">เข้าสู่ระบบ Smoothlife.com</h1>
        <p className="text-sm text-slate-500 mt-1">เข้าสู่ระบบเพื่อสะสมคะแนนและติดตามคำสั่งซื้อ</p>
      </div>

      {lineError && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 mb-5 text-sm text-amber-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{LINE_ERRORS[lineError] || LINE_ERRORS.line_error}</span>
        </div>
      )}

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
          {!firebaseConfigured() && (
            <DemoBadge text="ระบบ OTP ยังไม่ได้ตั้งค่า Firebase กรุณาติดต่อผู้ดูแลระบบ หรือเข้าสู่ระบบด้วย Email/LINE แทน" />
          )}
          <div id="recaptcha-container" key={recaptchaKey} />
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-slate-500">เบอร์โทรศัพท์</label>
              <input
                disabled={!firebaseConfigured()}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal disabled:opacity-50"
              />
              {otpError && <p className="text-xs text-rose-500">{otpError}</p>}
              <button
                disabled={!firebaseConfigured() || otpSending}
                className="flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {otpSending && <Loader2 size={15} className="animate-spin" />}
                {otpSending ? "กำลังส่งรหัส..." : "ส่งรหัส OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
              <p className="text-xs text-slate-500 text-center">
                ส่งรหัส OTP ไปที่ {toE164Thai(phone)} แล้ว กรุณากรอกรหัสที่ได้รับทาง SMS
              </p>
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
              <button
                disabled={otpVerifying || otpInput.length < 6}
                className="flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {otpVerifying && <Loader2 size={15} className="animate-spin" />}
                {otpVerifying ? "กำลังยืนยัน..." : "ยืนยันรหัส OTP"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtpInput("");
                  setOtpError("");
                  confirmationResultRef.current = null;
                }}
                className="text-xs text-slate-400"
              >
                เปลี่ยนเบอร์โทรศัพท์
              </button>
            </form>
          )}
        </div>
      )}

      {tab === "line" && (
        <div className="flex flex-col gap-4">
          <a
            href={`/api/auth/line/start?returnTo=${encodeURIComponent(returnTo)}`}
            className="flex items-center justify-center gap-2 rounded-full bg-[#06C755] text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity"
          >
            <MessageCircle size={18} /> เข้าสู่ระบบด้วย LINE
          </a>
        </div>
      )}

      {tab === "email" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 rounded-full bg-surface-soft p-1 text-xs">
            {[
              { id: "otp" as const, label: "เข้าด้วยรหัส OTP" },
              { id: "password" as const, label: "เข้าด้วยรหัสผ่าน" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setEmailMethod(m.id)}
                className={`flex-1 rounded-full py-2 font-semibold transition-colors ${
                  emailMethod === m.id ? "bg-white shadow-card text-brand-ink" : "text-slate-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {emailMethod === "otp" && (
            <div className="flex flex-col gap-3">
              {!emailOtpSent ? (
                <form onSubmit={handleSendEmailOtp} className="flex flex-col gap-3">
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="email"
                      value={emailOtpAddress}
                      onChange={(e) => setEmailOtpAddress(e.target.value)}
                      placeholder="อีเมล"
                      className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-3 text-sm outline-none focus:border-brand-teal"
                    />
                  </div>
                  {emailOtpError && <p className="text-xs text-rose-500">{emailOtpError}</p>}
                  <button
                    disabled={emailOtpSending}
                    className="flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {emailOtpSending && <Loader2 size={15} className="animate-spin" />}
                    {emailOtpSending ? "กำลังส่งรหัส..." : "ส่งรหัสยืนยัน"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyEmailOtp} className="flex flex-col gap-3">
                  <p className="text-xs text-slate-500 text-center">
                    ส่งรหัสยืนยันไปที่ {emailOtpAddress} แล้ว กรุณากรอกรหัสที่ได้รับทางอีเมล
                  </p>
                  {emailOtpDevCode && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">
                        ยังไม่ได้ตั้งค่าระบบส่งอีเมลจริงในโปรเจกต์นี้ — ใช้รหัสนี้แทนได้เลย (dev mode)
                      </p>
                      <p className="text-lg font-bold tracking-widest text-center text-amber-900">{emailOtpDevCode}</p>
                    </div>
                  )}
                  <input
                    value={emailOtpName}
                    onChange={(e) => setEmailOtpName(e.target.value)}
                    placeholder="ชื่อของคุณ (สำหรับสมาชิกใหม่)"
                    className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal"
                  />
                  <input
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value)}
                    placeholder="กรอกรหัสยืนยัน 6 หลัก"
                    maxLength={6}
                    className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal tracking-widest text-center"
                  />
                  {emailOtpError && <p className="text-xs text-rose-500">{emailOtpError}</p>}
                  <button
                    disabled={emailOtpVerifying || emailOtpCode.length < 6}
                    className="flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {emailOtpVerifying && <Loader2 size={15} className="animate-spin" />}
                    {emailOtpVerifying ? "กำลังยืนยัน..." : "ยืนยันรหัส"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailOtpSent(false);
                      setEmailOtpCode("");
                      setEmailOtpError("");
                      setEmailOtpDevCode("");
                    }}
                    className="text-xs text-slate-400"
                  >
                    เปลี่ยนอีเมล
                  </button>
                </form>
              )}
            </div>
          )}

          {emailMethod === "password" && (
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
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mt-8">
        การเข้าสู่ระบบถือว่าคุณยอมรับ{" "}
        <Link href="/help" className="underline">
          ข้อกำหนดการใช้บริการ
        </Link>{" "}
        ของ Smoothlife.com
      </p>
    </div>
  );
}

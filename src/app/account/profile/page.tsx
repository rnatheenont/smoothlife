"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon, Loader2, Camera, Mail, CheckCircle2 } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/lib/auth-context";
import { resizeForAvatar } from "@/lib/image-utils";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal";
const labelClass = "text-xs font-semibold text-slate-500 mb-1.5 block";

function ProfileContent() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [birthdate, setBirthdate] = useState(user?.birthdate || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      const resized = await resizeForAvatar(file);
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatar: resized.dataUrl }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "อัพโหลดไม่สำเร็จ");
      await refreshUser();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "อัพโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, phone, gender: gender || null, birthdate: birthdate || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "บันทึกไม่สำเร็จ");
      return;
    }
    await refreshUser();
    setSaved(true);
    setTimeout(() => router.push("/account"), 800);
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-2 text-brand-emerald mb-2">
        <UserIcon size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">Profile</span>
      </div>
      <h1 className="text-2xl font-bold text-brand-ink mb-6">แก้ไขโปรไฟล์</h1>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="relative shrink-0">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-gradient text-white text-xl font-bold overflow-hidden">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                name.charAt(0).toUpperCase() || "?"
              )}
              {avatarBusy && (
                <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
                  <Loader2 size={18} className="animate-spin text-white" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              aria-label="เปลี่ยนรูปโปรไฟล์"
              className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-white text-brand-emerald border border-slate-200 shadow-sm disabled:opacity-60"
            >
              <Camera size={12} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarPick}
            />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-ink">{user.name}</p>
            <p className="text-xs text-slate-400">{user.email || user.phone}</p>
            {avatarError && <p className="text-xs text-rose-500 mt-1">{avatarError}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>ชื่อ-นามสกุล</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>เบอร์โทรศัพท์</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="0891234567"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>เพศ</label>
          <select value={gender || ""} onChange={(e) => setGender(e.target.value)} className={inputClass}>
            <option value="">ไม่ระบุ</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
            <option value="other">อื่นๆ</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>วันเกิด</label>
          {/* iOS renders the native date value in the device's locale
              format (e.g. Thai Buddhist-era "22 Jan BE 2537"), which can be
              wider than the box and overflow — appearance-none + max-w-full
              stops WebKit's native control from ignoring the width. */}
          <input
            type="date"
            value={birthdate || ""}
            onChange={(e) => setBirthdate(e.target.value)}
            className={`${inputClass} appearance-none max-w-full`}
          />
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}
        {saved && <p className="text-sm text-brand-emerald">บันทึกแล้ว</p>}

        <button
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-brand-ink text-white font-semibold py-3.5 text-sm disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          บันทึกโปรไฟล์
        </button>
      </form>
    </div>
  );
}

// Shown only for accounts that signed in via phone OTP or LINE and have no
// verified email on file yet — lets them add one, verified with the same
// emailed-OTP flow already used for email login (see LoginContent.tsx).
function EmailLinkCard() {
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");
  const [justLinked, setJustLinked] = useState<string | null>(null);

  if (!user || (user.email && !justLinked)) return null;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setDevCode("");
    setSending(true);
    try {
      const res = await fetch("/api/auth/email-otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ส่งรหัสไม่สำเร็จ");
        return;
      }
      if (!data.emailSent && data.devCode) setDevCode(data.devCode);
      setSent(true);
    } catch {
      setError("ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/email-otp/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ยืนยันไม่สำเร็จ");
        return;
      }
      await refreshUser();
      setJustLinked(data.email || email.trim());
    } catch {
      setError("ยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setVerifying(false);
    }
  }

  if (justLinked) {
    return (
      <div className="max-w-md mt-6 rounded-xl2 border border-slate-200 p-5">
        <div className="flex items-center gap-2 text-brand-emerald mb-1">
          <Mail size={16} />
          <span className="text-xs font-semibold uppercase tracking-wide">Email</span>
        </div>
        <h2 className="text-sm font-bold text-brand-ink mb-3">เพิ่มและยืนยันอีเมล</h2>
        <p className="flex items-center gap-2 text-sm text-brand-emerald">
          <CheckCircle2 size={16} /> ยืนยัน {justLinked} สำเร็จแล้ว
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mt-6 rounded-xl2 border border-slate-200 p-5">
      <div className="flex items-center gap-2 text-brand-emerald mb-1">
        <Mail size={16} />
        <span className="text-xs font-semibold uppercase tracking-wide">Email</span>
      </div>
      <h2 className="text-sm font-bold text-brand-ink mb-1">เพิ่มและยืนยันอีเมล</h2>
      <p className="text-xs text-slate-400 mb-4">
        บัญชีนี้ยังไม่มีอีเมล เพิ่มไว้เพื่อใช้เข้าสู่ระบบได้อีกทาง และรับการแจ้งเตือนคำสั่งซื้อ
      </p>

      {!sent ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล"
            className={inputClass}
          />
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            disabled={sending}
            className="flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-2.5 text-sm disabled:opacity-60"
          >
            {sending && <Loader2 size={14} className="animate-spin" />}
            {sending ? "กำลังส่งรหัส..." : "ส่งรหัสยืนยัน"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">ส่งรหัสยืนยันไปที่ {email} แล้ว กรุณากรอกรหัสที่ได้รับทางอีเมล</p>
          {devCode && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">
                ยังไม่ได้ตั้งค่าระบบส่งอีเมลจริงในโปรเจกต์นี้ — ใช้รหัสนี้แทนได้เลย (dev mode)
              </p>
              <p className="text-lg font-bold tracking-widest text-center text-amber-900">{devCode}</p>
            </div>
          )}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="กรอกรหัสยืนยัน 6 หลัก"
            maxLength={6}
            className={`${inputClass} tracking-widest text-center`}
          />
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            disabled={verifying || code.length < 6}
            className="flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-2.5 text-sm disabled:opacity-60"
          >
            {verifying && <Loader2 size={14} className="animate-spin" />}
            {verifying ? "กำลังยืนยัน..." : "ยืนยันอีเมล"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
              setError("");
              setDevCode("");
            }}
            className="text-xs text-slate-400"
          >
            เปลี่ยนอีเมล
          </button>
        </form>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AccountLayout>
      <ProfileContent />
      <EmailLinkCard />
    </AccountLayout>
  );
}

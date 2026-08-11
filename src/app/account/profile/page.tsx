"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon, Loader2, Camera } from "lucide-react";
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
          <input
            type="date"
            value={birthdate || ""}
            onChange={(e) => setBirthdate(e.target.value)}
            className={inputClass}
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

export default function ProfilePage() {
  return (
    <AccountLayout>
      <ProfileContent />
    </AccountLayout>
  );
}

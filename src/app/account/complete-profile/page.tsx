"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import AddressFields, { AddressFormValue, emptyAddressForm } from "@/components/account/AddressFields";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_NAME = "สมาชิกใหม่";

function CompleteProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [needsEmail, setNeedsEmail] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [wantsAddress, setWantsAddress] = useState(false);
  const [address, setAddress] = useState<AddressFormValue>(emptyAddressForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // This page is only reachable right after a brand-new OAuth signup — if
  // there's no active session (direct link, expired session), bounce to
  // login instead of showing a form with nothing to attach it to.
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace("/account/login");
          return;
        }
        setName(data.user.name && data.user.name !== PLACEHOLDER_NAME ? data.user.name : "");
        // Phone/email OTP signups already have a verified phone on file (in
        // +66 E.164 form) — reuse it as the address-recipient default below,
        // but never re-show or re-validate it as if it still needed typing.
        const rawPhone: string = data.user.phone || "";
        if (rawPhone) {
          setPhone(rawPhone.startsWith("+66") ? "0" + rawPhone.slice(3) : rawPhone);
        } else {
          setNeedsPhone(true);
        }
        if (data.user.email) setEmail(data.user.email);
        else setNeedsEmail(true);
      })
      .finally(() => setLoading(false));
  }, [router]);

  function toggleAddress(checked: boolean) {
    setWantsAddress(checked);
    if (checked) {
      setAddress((a) => ({ ...a, recipient_name: a.recipient_name || name, phone: a.phone || phone }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (needsPhone && phoneDigits.length !== 10) {
      setError("เบอร์มือถือต้องมี 10 หลัก");
      return;
    }
    if (needsEmail && !EMAIL_RE.test(email.trim())) {
      setError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }

    setBusy(true);
    const profileRes = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        ...(needsPhone ? { phone: phoneDigits } : {}),
        ...(needsEmail ? { email: email.trim() } : {}),
      }),
    });
    const profileData = await profileRes.json();
    if (!profileData.ok) {
      setBusy(false);
      setError(profileData.error || "บันทึกข้อมูลไม่สำเร็จ");
      return;
    }

    if (wantsAddress && address.address_line.trim()) {
      await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(address),
      }).catch(() => {});
    }

    setBusy(false);
    router.push(returnTo);
  }

  if (loading) return <div className="container-page py-20 text-center text-slate-400">กำลังโหลด...</div>;

  return (
    <div className="container-page min-h-[70vh] flex items-center justify-center py-10 md:py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white shadow-card p-6 md:p-8">
        <h1 className="text-2xl font-extrabold text-brand-ink mb-1">ยินดีต้อนรับ</h1>
        <p className="text-sm text-slate-500 mb-6">กรอกข้อมูลเพิ่มเติมอีกนิด เพื่อให้เราดูแลคุณได้ดีขึ้น</p>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">ชื่อ-นามสกุล</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-full bg-surface-soft px-4 py-3 text-sm outline-hidden focus:ring-2 focus:ring-brand-teal/40"
            />
          </div>
          {needsPhone && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">เบอร์โทรศัพท์</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                inputMode="numeric"
                autoComplete="tel"
                className="w-full rounded-full bg-surface-soft px-4 py-3 text-sm outline-hidden focus:ring-2 focus:ring-brand-teal/40"
              />
            </div>
          )}
          {needsEmail && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">อีเมล</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                className="w-full rounded-full bg-surface-soft px-4 py-3 text-sm outline-hidden focus:ring-2 focus:ring-brand-teal/40"
              />
            </div>
          )}

          <label className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 mt-1">
            <span className="text-sm text-slate-600">เพิ่มที่อยู่จัดส่งตอนนี้เลย</span>
            <input
              type="checkbox"
              checked={wantsAddress}
              onChange={(e) => toggleAddress(e.target.checked)}
              className="h-5 w-9 accent-brand-emerald"
            />
          </label>
          {wantsAddress && <AddressFields value={address} onChange={setAddress} showDefaultToggle={false} />}

          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            disabled={busy}
            className="rounded-full bg-brand-gradient text-white font-bold py-3.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-60 mt-1 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            เริ่มใช้งาน
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-slate-400">กำลังโหลด...</div>}>
      <CompleteProfileContent />
    </Suspense>
  );
}

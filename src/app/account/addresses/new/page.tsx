"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft, Loader2 } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import AddressFields, { AddressFormValue, emptyAddressForm } from "@/components/account/AddressFields";

function NewAddressContent() {
  const router = useRouter();
  const [value, setValue] = useState<AddressFormValue>(emptyAddressForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "บันทึกที่อยู่ไม่สำเร็จ");
      return;
    }
    router.push("/account/addresses");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 text-brand-emerald mb-2">
        <MapPin size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">Shipping address</span>
      </div>
      <h1 className="text-2xl font-bold text-brand-ink mb-6">เพิ่มที่อยู่จัดส่ง</h1>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <AddressFields value={value} onChange={setValue} />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-brand-ink text-white font-semibold py-3.5 text-sm disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          บันทึกที่อยู่
        </button>
        <Link href="/account/addresses" className="flex items-center justify-center gap-1.5 text-sm text-slate-400">
          <ArrowLeft size={14} /> กลับ
        </Link>
      </form>
    </div>
  );
}

export default function NewAddressPage() {
  return (
    <AccountLayout>
      <NewAddressContent />
    </AccountLayout>
  );
}

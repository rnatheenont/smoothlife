"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt, ArrowLeft, Loader2 } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import TaxAddressFields, { TaxAddressFormValue, emptyTaxAddressForm } from "@/components/account/TaxAddressFields";

function NewTaxAddressContent() {
  const router = useRouter();
  const [value, setValue] = useState<TaxAddressFormValue>(emptyTaxAddressForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/tax-addresses", {
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
    router.push("/account/tax-addresses");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 text-brand-emerald mb-2">
        <Receipt size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">Tax invoice address</span>
      </div>
      <h1 className="text-2xl font-bold text-brand-ink mb-6">เพิ่มที่อยู่ใบกำกับภาษี</h1>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <TaxAddressFields value={value} onChange={setValue} />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-brand-ink text-white font-semibold py-3.5 text-sm disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          บันทึกที่อยู่
        </button>
        <Link href="/account/tax-addresses" className="flex items-center justify-center gap-1.5 text-sm text-slate-400">
          <ArrowLeft size={14} /> กลับ
        </Link>
      </form>
    </div>
  );
}

export default function NewTaxAddressPage() {
  return (
    <AccountLayout>
      <NewTaxAddressContent />
    </AccountLayout>
  );
}

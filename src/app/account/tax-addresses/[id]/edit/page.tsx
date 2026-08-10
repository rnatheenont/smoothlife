"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Receipt, ArrowLeft, Loader2 } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import TaxAddressFields, { TaxAddressFormValue, emptyTaxAddressForm } from "@/components/account/TaxAddressFields";
import type { TaxAddressRow } from "@/app/api/account/tax-addresses/route";

function EditTaxAddressContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [value, setValue] = useState<TaxAddressFormValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/tax-addresses")
      .then((r) => r.json())
      .then((data) => {
        const found = (data.addresses || []).find((a: TaxAddressRow) => a.id === params.id);
        setValue(
          found
            ? {
                label: found.label || "",
                is_company: found.is_company,
                recipient_name: found.recipient_name,
                tax_id: found.tax_id,
                phone: found.phone,
                email: found.email || "",
                address_line: found.address_line,
                subdistrict: found.subdistrict,
                district: found.district,
                province: found.province,
                postal_code: found.postal_code,
                country: found.country || "TH",
                is_default: found.is_default,
              }
            : emptyTaxAddressForm
        );
      })
      .catch(() => setValue(emptyTaxAddressForm));
  }, [params.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/account/tax-addresses/${params.id}`, {
      method: "PATCH",
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
      <h1 className="text-2xl font-bold text-brand-ink mb-6">แก้ไขที่อยู่ใบกำกับภาษี</h1>
      {!value ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : (
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
      )}
    </div>
  );
}

export default function EditTaxAddressPage() {
  return (
    <AccountLayout>
      <EditTaxAddressContent />
    </AccountLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft, Loader2 } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import AddressFields, { AddressFormValue, emptyAddressForm } from "@/components/account/AddressFields";
import { SHOPIFY_ADDRESS_SUGGESTION_KEY } from "@/lib/auth-context";

function NewAddressContent() {
  const router = useRouter();
  const [value, setValue] = useState<AddressFormValue>(emptyAddressForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromShopify, setFromShopify] = useState(false);

  // One-time prefill from a Shopify default-address suggestion, if the
  // customer got here via the banner on /account/addresses. Never fills
  // subdistrict/district — Shopify's address has no such fields to draw
  // from reliably, so the customer must pick those themselves.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHOPIFY_ADDRESS_SUGGESTION_KEY);
      if (!raw) return;
      const suggestion = JSON.parse(raw) as { address_line: string; province: string; postal_code: string; country: string };
      setValue((v) => ({
        ...v,
        address_line: suggestion.address_line || v.address_line,
        province: suggestion.province || v.province,
        postal_code: suggestion.postal_code || v.postal_code,
        country: suggestion.country || v.country,
      }));
      setFromShopify(true);
      localStorage.removeItem(SHOPIFY_ADDRESS_SUGGESTION_KEY);
    } catch {}
  }, []);

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
      <h1 className="text-2xl font-bold text-brand-ink mb-2">เพิ่มที่อยู่จัดส่ง</h1>
      {fromShopify && (
        <p className="text-xs text-brand-emerald bg-brand-gradient-soft rounded-lg px-3 py-2 mb-4">
          เติมที่อยู่จากบัญชี Shopify ของคุณให้แล้ว กรุณาตรวจสอบและกรอกชื่อผู้รับ เบอร์โทร ตำบล/อำเภอ ให้ครบก่อนบันทึก
        </p>
      )}
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

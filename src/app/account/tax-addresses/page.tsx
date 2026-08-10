"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, Plus, Pencil, Trash2, Check, Loader2, Building2 } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/lib/auth-context";
import DemoBadge from "@/components/DemoBadge";
import type { TaxAddressRow } from "@/app/api/account/tax-addresses/route";
import { countryName } from "@/components/AddressForm";

function TaxAddressesContent() {
  const { user } = useAuth();
  const isReal = user?.provider === "email";
  const [addresses, setAddresses] = useState<TaxAddressRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/account/tax-addresses")
      .then((r) => r.json())
      .then((data) => setAddresses(data.addresses || []))
      .catch(() => setAddresses([]));
  }

  useEffect(() => {
    if (isReal) load();
    else setAddresses([]);
  }, [isReal]);

  async function setDefault(id: string) {
    setBusyId(id);
    await fetch(`/api/account/tax-addresses/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    setBusyId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("ลบที่อยู่ใบกำกับภาษีนี้?")) return;
    setBusyId(id);
    await fetch(`/api/account/tax-addresses/${id}`, { method: "DELETE" });
    setBusyId(null);
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-ink mb-2">ที่อยู่ใบกำกับภาษี</h1>
      <p className="text-sm text-slate-500 mb-6">จัดการที่อยู่สำหรับออกใบกำกับภาษีเต็มรูปแบบ</p>

      {!isReal && (
        <div className="mb-6">
          <DemoBadge text="สมุดที่อยู่ผูกกับบัญชีจริง (Email) เท่านั้นตอนนี้ — เข้าสู่ระบบด้วยอีเมลเพื่อบันทึกที่อยู่จริงลงฐานข้อมูล" />
        </div>
      )}

      {isReal && addresses === null && <p className="text-sm text-slate-400">กำลังโหลด...</p>}

      {isReal && addresses && (
        <div className="flex flex-col gap-3 mb-5">
          {addresses.length === 0 && (
            <div className="rounded-xl2 border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              ยังไม่มีที่อยู่ใบกำกับภาษี
            </div>
          )}
          {addresses.map((a) => (
            <div key={a.id} className="rounded-xl2 border border-slate-100 shadow-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {a.is_company ? (
                    <Building2 size={16} className="text-brand-emerald mt-0.5 shrink-0" />
                  ) : (
                    <Receipt size={16} className="text-brand-emerald mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-brand-ink">{a.label}</span>
                      {a.is_default && (
                        <span className="text-[10px] font-semibold text-brand-emerald bg-brand-gradient-soft rounded-full px-2 py-0.5">
                          ค่าเริ่มต้น
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">เลขผู้เสียภาษี {a.tax_id}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      {a.recipient_name}
                      <br />
                      {a.address_line} แขวง/ตำบล{a.subdistrict} เขต/อำเภอ{a.district} จ.{a.province} {a.postal_code}
                      {a.country && a.country !== "TH" ? ` ${countryName(a.country)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex gap-1.5">
                    <Link
                      href={`/account/tax-addresses/${a.id}/edit`}
                      className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-surface-soft"
                    >
                      <Pencil size={13} />
                    </Link>
                    <button
                      onClick={() => remove(a.id)}
                      disabled={busyId === a.id}
                      className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      {busyId === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                  {!a.is_default && (
                    <button
                      onClick={() => setDefault(a.id)}
                      disabled={busyId === a.id}
                      className="flex items-center gap-1 text-[11px] font-semibold text-brand-emerald"
                    >
                      <Check size={11} /> ตั้งเป็นค่าเริ่มต้น
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/account/tax-addresses/new"
        className="flex items-center justify-center gap-2 rounded-xl2 border border-dashed border-slate-200 py-3.5 text-sm font-semibold text-brand-emerald hover:border-brand-teal"
      >
        <Plus size={16} /> เพิ่มที่อยู่ใหม่
      </Link>
    </div>
  );
}

export default function TaxAddressesPage() {
  return (
    <AccountLayout>
      <TaxAddressesContent />
    </AccountLayout>
  );
}

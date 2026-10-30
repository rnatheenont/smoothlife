"use client";

import { useState } from "react";
import { Building2, Check, Loader2, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import TaxAddressFields, {
  TaxAddressFormValue,
  emptyTaxAddressForm,
} from "@/components/account/TaxAddressFields";
import DemoBadge from "@/components/DemoBadge";
import { countryName } from "@/components/AddressForm";
import { useAuth } from "@/lib/auth-context";
import { useAddressBook } from "@/components/account/use-address-book";
import type { TaxAddressRow } from "@/app/api/account/tax-addresses/route";

// The tax-invoice address book, in place. Same shape as the shipping card
// next to it on purpose — the two books are the same idea with different
// fields, and a shopper should not have to learn them separately.

const CARD = "rounded-xl2 border border-slate-200 bg-white p-5";

export default function TaxAddressBookCard() {
  const { user } = useAuth();
  const isReal = Boolean(user?.real);
  const { rows, busyId, load, setDefault, remove } = useAddressBook<TaxAddressRow>(
    "/api/account/tax-addresses",
    isReal,
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const [value, setValue] = useState<TaxAddressFormValue>(emptyTaxAddressForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(a: TaxAddressRow) {
    setValue({
      label: a.label ?? "",
      is_company: a.is_company,
      recipient_name: a.recipient_name,
      tax_id: a.tax_id,
      phone: a.phone ?? "",
      email: a.email ?? "",
      address_line: a.address_line,
      subdistrict: a.subdistrict,
      district: a.district,
      province: a.province,
      postal_code: a.postal_code,
      country: a.country || "TH",
      is_default: a.is_default,
    });
    setError(null);
    setOpenId(a.id);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const creating = openId === "new";
    const res = await fetch(
      creating ? "/api/account/tax-addresses" : `/api/account/tax-addresses/${openId}`,
      {
        method: creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      },
    ).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!data?.ok) {
      setError(data?.error || "บันทึกที่อยู่ใบกำกับภาษีไม่สำเร็จ");
      return;
    }
    setOpenId(null);
    load();
  }

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-ink">
          <Receipt size={16} className="text-brand-800" />
          ที่อยู่ใบกำกับภาษี
        </p>
        {isReal && (
          <button
            type="button"
            onClick={() => {
              setValue(emptyTaxAddressForm);
              setError(null);
              setOpenId("new");
            }}
            className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-slate-50"
          >
            <Plus size={13} /> เพิ่ม
          </button>
        )}
      </div>

      {!isReal && (
        <div className="mt-3">
          <DemoBadge text="สมุดที่อยู่ผูกกับบัญชีจริง (Email) เท่านั้นตอนนี้ — เข้าสู่ระบบด้วยอีเมลเพื่อบันทึกที่อยู่จริงลงฐานข้อมูล" />
        </div>
      )}

      <Modal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        title={openId === "new" ? "เพิ่มที่อยู่ใบกำกับภาษี" : "แก้ไขที่อยู่ใบกำกับภาษี"}
      >
        <form onSubmit={submit} className="flex flex-col gap-5">
          <TaxAddressFields value={value} onChange={setValue} />
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="h-12 flex-1 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
            >
              ยกเลิก
            </button>
            <button
              disabled={busy}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-ink text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              บันทึก
            </button>
          </div>
        </form>
      </Modal>

      {isReal && (
        <div className="mt-3 flex flex-col gap-3">
          {rows === null && <p className="text-sm text-slate-500">กำลังโหลด…</p>}
          {rows?.length === 0 && (
            <div className="rounded-xl2 border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              ยังไม่มีที่อยู่ใบกำกับภาษี
            </div>
          )}
          {rows?.map((a) => (
            <div key={a.id} className="rounded-xl2 border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  {a.is_company ? (
                    <Building2 size={16} className="mt-0.5 shrink-0 text-brand-emerald" />
                  ) : (
                    <Receipt size={16} className="mt-0.5 shrink-0 text-brand-emerald" />
                  )}
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-sm font-bold text-brand-ink">{a.label}</span>
                      {a.is_default && (
                        <span className="rounded-full bg-brand-gradient-soft px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                          ค่าเริ่มต้น
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">เลขผู้เสียภาษี {a.tax_id}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      {a.recipient_name}
                      <br />
                      {a.address_line} แขวง/ตำบล{a.subdistrict} เขต/อำเภอ{a.district} จ.{a.province}{" "}
                      {a.postal_code}
                      {a.country && a.country !== "TH" ? ` ${countryName(a.country)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      aria-label="แก้ไขที่อยู่ใบกำกับภาษี"
                      className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-surface-soft"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(a.id, "ลบที่อยู่ใบกำกับภาษีนี้?")}
                      disabled={busyId === a.id}
                      aria-label="ลบที่อยู่ใบกำกับภาษี"
                      className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-500"
                    >
                      {busyId === a.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                  {!a.is_default && (
                    <button
                      type="button"
                      onClick={() => setDefault(a.id)}
                      disabled={busyId === a.id}
                      className="flex items-center gap-1 text-[11px] font-semibold text-brand-800"
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
    </div>
  );
}

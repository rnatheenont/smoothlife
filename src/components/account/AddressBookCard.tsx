"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, MapPin, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui";
import AddressFields, { AddressFormValue, emptyAddressForm } from "@/components/account/AddressFields";
import DemoBadge from "@/components/DemoBadge";
import { countryName } from "@/components/AddressForm";
import { SHOPIFY_ADDRESS_SUGGESTION_KEY, useAuth } from "@/lib/auth-context";
import { useAddressBook } from "@/components/account/use-address-book";
import type { AddressRow } from "@/app/api/account/addresses/route";

// The shipping address book, on the page it is used from.
//
// Adding and editing happen in a dialog over this page rather than on their
// own routes. The two pages this replaces did the same work, but a page
// change to fill in four fields and a page change back is a lot of movement
// for an edit somebody usually makes because they noticed a typo while
// looking at it. The routes still exist and still work.
//
// A dialog rather than a panel that pushes the card open: the list stays
// where it was, so closing the form puts you back exactly where you were
// reading. Modal gives it Escape, a focus trap and a locked background, and
// on a phone it arrives as a sheet from the bottom.

type AddressSuggestion = {
  address_line: string;
  province: string;
  postal_code: string;
  country: string;
  recipient_name?: string;
  phone?: string;
  subdistrict?: string;
  district?: string;
  missing?: string[];
};

const CARD = "rounded-xl2 border border-slate-200 bg-white p-5";

export default function AddressBookCard() {
  const { user } = useAuth();
  const isReal = Boolean(user?.real);
  const { rows, busyId, load, setDefault, remove } = useAddressBook<AddressRow>(
    "/api/account/addresses",
    isReal,
  );

  // null = closed, "new" = adding, otherwise the id being edited.
  const [openId, setOpenId] = useState<string | null>(null);
  const [value, setValue] = useState<AddressFormValue>(emptyAddressForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suggestion, setSuggestion] = useState<AddressSuggestion | null>(null);
  // Session-scoped: dismissing hides it now without deciding for them forever,
  // since the address is read live and they may want it on a later visit.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHOPIFY_ADDRESS_SUGGESTION_KEY);
      if (raw) setSuggestion(JSON.parse(raw));
    } catch {}
  }, []);

  // The live copy as well as the one carried from a fresh login: a returning
  // customer linked to their old orders after signing up never had anything
  // put in their localStorage, so the banner could not appear however many
  // parcels we had shipped them.
  useEffect(() => {
    if (!isReal || dismissed) return;
    let cancelled = false;
    fetch("/api/account/shopify-address")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.suggestion) setSuggestion(data.suggestion);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isReal, dismissed]);

  function dismissSuggestion() {
    try {
      localStorage.removeItem(SHOPIFY_ADDRESS_SUGGESTION_KEY);
    } catch {}
    setSuggestion(null);
    setDismissed(true);
  }

  function openNew(prefill?: Partial<AddressFormValue>) {
    setValue({ ...emptyAddressForm, ...prefill });
    setError(null);
    setOpenId("new");
  }

  function openEdit(a: AddressRow) {
    setValue({
      label: a.label ?? "",
      recipient_name: a.recipient_name,
      phone: a.phone,
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
    const res = await fetch(creating ? "/api/account/addresses" : `/api/account/addresses/${openId}`, {
      method: creating ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!data?.ok) {
      setError(data?.error || "บันทึกที่อยู่ไม่สำเร็จ");
      return;
    }
    setOpenId(null);
    load();
  }

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-ink">
          <MapPin size={16} className="text-brand-800" />
          ที่อยู่จัดส่ง
        </p>
        {isReal && (
          <button
            type="button"
            onClick={() => openNew()}
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

      {/* Shown whether or not the book is empty: a customer who saved a work
          address is exactly the one who still needs their home one offered.
          The API withholds it once it is actually in the book. */}
      {isReal && suggestion && (
        <div className="mt-3 rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-brand-ink">ที่อยู่จากคำสั่งซื้อที่ผ่านมาของคุณ</p>
              {suggestion.recipient_name && (
                <p className="mt-0.5 text-xs font-semibold text-slate-600">
                  {suggestion.recipient_name}
                  {suggestion.phone ? ` · ${suggestion.phone}` : ""}
                </p>
              )}
              <p className="mt-0.5 text-xs text-slate-500">
                {suggestion.address_line}
                {suggestion.subdistrict ? ` แขวง/ตำบล${suggestion.subdistrict}` : ""}
                {suggestion.district ? ` ${suggestion.district}` : ""}
                {suggestion.province ? ` ${suggestion.province}` : ""} {suggestion.postal_code}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {suggestion.missing && suggestion.missing.length > 0
                  ? `กรุณาตรวจสอบและกรอก${suggestion.missing.join(" / ")}ให้ครบก่อนบันทึก`
                  : "ตรวจสอบความถูกต้องอีกครั้งก่อนบันทึกได้เลย"}
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    openNew({
                      recipient_name: suggestion.recipient_name || "",
                      phone: suggestion.phone || "",
                      address_line: suggestion.address_line || "",
                      // Filled when they can be worked out, left empty rather
                      // than guessed — see lib/shopify-address.ts.
                      subdistrict: suggestion.subdistrict || "",
                      district: suggestion.district || "",
                      province: suggestion.province || "",
                      postal_code: suggestion.postal_code || "",
                      country: suggestion.country || "TH",
                    })
                  }
                  className="text-xs font-semibold text-brand-800"
                >
                  ใช้ที่อยู่นี้
                </button>
                <button type="button" onClick={dismissSuggestion} className="text-xs text-slate-500">
                  ไม่ใช้ตอนนี้
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissSuggestion}
              aria-label="ปิด"
              className="shrink-0 text-slate-300 hover:text-slate-500"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <Modal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        title={openId === "new" ? "เพิ่มที่อยู่จัดส่ง" : "แก้ไขที่อยู่จัดส่ง"}
      >
        <form onSubmit={submit} className="flex flex-col gap-5">
          <AddressFields value={value} onChange={setValue} />
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
              ยังไม่มีที่อยู่จัดส่ง
            </div>
          )}
          {rows?.map((a) => (
            <div key={a.id} className="rounded-xl2 border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-brand-emerald" />
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-sm font-bold text-brand-ink">{a.label}</span>
                      {a.is_default && (
                        <span className="rounded-full bg-brand-gradient-soft px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                          ค่าเริ่มต้น
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{a.phone}</p>
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
                      aria-label="แก้ไขที่อยู่"
                      className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-surface-soft"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(a.id, "ลบที่อยู่นี้?")}
                      disabled={busyId === a.id}
                      aria-label="ลบที่อยู่"
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

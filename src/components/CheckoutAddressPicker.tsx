"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, X, Check, AlertTriangle } from "lucide-react";
import AddressFields, { AddressFormValue, emptyAddressForm } from "@/components/account/AddressFields";
import { isValidPhoneForCountry, THAI_PHONE_HINT } from "@/lib/phone";
import type { AddressRow } from "@/app/api/account/addresses/route";

// Checkout's shipping-address step. Typing a full address into the checkout
// page itself is the slowest possible path for a returning customer who has
// already given us one, so the page shows saved addresses as a pick list and
// keeps the form itself in a modal that only opens when there is genuinely
// something new to enter. Anything entered here is saved to the account too,
// so the next order is a single tap.
//
// Signed-out shoppers get the same modal, minus the saving — checkout must
// never require an account.

function rowToForm(row: AddressRow): AddressFormValue {
  return {
    label: row.label ?? "บ้าน",
    recipient_name: row.recipient_name,
    phone: row.phone,
    address_line: row.address_line,
    subdistrict: row.subdistrict,
    district: row.district,
    province: row.province,
    postal_code: row.postal_code,
    country: row.country,
    is_default: row.is_default,
  };
}

function isComplete(v: AddressFormValue) {
  return Boolean(
    v.recipient_name && v.phone && v.address_line && v.subdistrict && v.district && v.province && v.postal_code
  );
}

function oneLine(v: AddressFormValue) {
  return [v.address_line, v.subdistrict, v.district, v.province, v.postal_code].filter(Boolean).join(" ");
}

export default function CheckoutAddressPicker({
  value,
  onChange,
  canSave,
}: {
  value: AddressFormValue;
  onChange: (v: AddressFormValue) => void;
  /** Signed-in with a real account — saved addresses can be loaded and written back. */
  canSave: boolean;
}) {
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(canSave);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<AddressFormValue>(emptyAddressForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!canSave) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows: AddressRow[] = data.addresses ?? [];
        setAddresses(rows);
        // The API already sorts default-first, so rows[0] is the one the
        // customer would have picked anyway — preselect it rather than making
        // them choose when there is an obvious answer.
        if (rows[0]) {
          setSelectedId(rows[0].id);
          onChange(rowToForm(rows[0]));
        }
      })
      .catch(() => {
        /* leave the list empty — the modal is still a complete path */
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave]);

  function pick(row: AddressRow) {
    setSelectedId(row.id);
    onChange(rowToForm(row));
  }

  function openNew() {
    setDraft(emptyAddressForm);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEditCurrent() {
    setDraft(value);
    setSaveError(null);
    setModalOpen(true);
  }

  async function saveDraft() {
    if (!isComplete(draft)) {
      setSaveError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    // The field itself already filters and flags this, but an address the
    // courier can't call is worth stopping at the point of no return too.
    if (!isValidPhoneForCountry(draft.phone, draft.country)) {
      setSaveError(THAI_PHONE_HINT);
      return;
    }
    // Signed out: the address is still perfectly usable for this order, it
    // just has nowhere to live afterwards.
    if (!canSave) {
      onChange(draft);
      setSelectedId(null);
      setModalOpen(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSaveError(data.error || "บันทึกที่อยู่ไม่สำเร็จ");
        return;
      }
      const created: AddressRow = data.address;
      // A new default demotes the others server-side; mirror that here so the
      // list doesn't show two defaults until the next reload.
      setAddresses((prev) =>
        created.is_default ? [created, ...prev.map((a) => ({ ...a, is_default: false }))] : [...prev, created]
      );
      setSelectedId(created.id);
      onChange(rowToForm(created));
      setModalOpen(false);
    } catch {
      setSaveError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-400 flex items-center gap-1.5">
        <Loader2 size={14} className="animate-spin" /> กำลังโหลด...
      </p>
    );
  }

  const usingUnsaved = !selectedId && isComplete(value);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {addresses.map((row) => {
          const active = row.id === selectedId;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => pick(row)}
              aria-pressed={active}
              className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                active ? "border-brand-teal bg-brand-gradient-soft" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                    active ? "border-brand-teal bg-brand-teal" : "border-slate-300"
                  }`}
                >
                  {active && <Check size={11} className="text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-brand-ink">{row.recipient_name}</span>
                    {row.label && (
                      <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-slate-500">
                        {row.label}
                      </span>
                    )}
                    {row.is_default && (
                      <span className="rounded-full bg-brand-gradient-soft px-2 py-0.5 text-[11px] font-semibold text-brand-emerald">
                        ค่าเริ่มต้น
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{row.phone}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{oneLine(rowToForm(row))}</span>
                </span>
              </span>
            </button>
          );
        })}

        {usingUnsaved && (
          <div className="rounded-xl border border-brand-teal bg-brand-gradient-soft p-3.5">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-brand-emerald" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-ink">{value.recipient_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{value.phone}</p>
                <p className="mt-0.5 text-xs text-slate-500">{oneLine(value)}</p>
              </div>
              <button
                type="button"
                onClick={openEditCurrent}
                className="shrink-0 text-xs font-semibold text-brand-emerald"
              >
                แก้ไข
              </button>
            </div>
          </div>
        )}

        {addresses.length === 0 && !usingUnsaved && (
          <p className="text-sm text-slate-500">ยังไม่มีที่อยู่จัดส่ง — เพิ่มที่อยู่เพื่อดำเนินการต่อ</p>
        )}

        <button
          type="button"
          onClick={openNew}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-brand-emerald transition-colors hover:border-brand-teal"
        >
          <Plus size={15} /> เพิ่มที่อยู่ใหม่
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setModalOpen(false)} />
          <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-xl2 bg-white shadow-cardHover animate-fadeUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 font-bold text-brand-ink">
                <MapPin size={17} className="text-brand-emerald" /> ที่อยู่จัดส่ง
              </h3>
              <button type="button" onClick={() => !saving && setModalOpen(false)} aria-label="ปิด">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <AddressFields value={draft} onChange={setDraft} showDefaultToggle={canSave} />
              {saveError && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-rose-600">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {saveError}
                </p>
              )}
              {!canSave && (
                <p className="mt-3 text-[11px] text-slate-400">
                  เข้าสู่ระบบเพื่อบันทึกที่อยู่นี้ไว้ใช้ครั้งต่อไป — สั่งซื้อครั้งนี้ไม่ต้องเข้าสู่ระบบก็ได้
                </p>
              )}
            </div>

            <div className="flex gap-2.5 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="flex-1 rounded-full bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" /> กำลังบันทึก...
                  </span>
                ) : canSave ? (
                  "บันทึกและใช้ที่อยู่นี้"
                ) : (
                  "ใช้ที่อยู่นี้"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

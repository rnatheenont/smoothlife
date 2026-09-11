"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Plus, Pencil, Trash2, Check, Loader2, Sparkles, X } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/lib/auth-context";
import { SHOPIFY_ADDRESS_SUGGESTION_KEY } from "@/lib/auth-context";
import DemoBadge from "@/components/DemoBadge";
import type { AddressRow } from "@/app/api/account/addresses/route";
import { countryName } from "@/components/AddressForm";

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

function AddressesContent() {
  const { user } = useAuth();
  const isReal = user?.real;
  const [addresses, setAddresses] = useState<AddressRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AddressSuggestion | null>(null);
  // Session-scoped: dismissing hides it now without deciding for them forever,
  // since the address is read live and they may want it on a later visit.
  const [dismissed, setDismissed] = useState(false);

  // The one carried from a fresh login, if there is one — then the live copy.
  //
  // Reading it from the server as well is what makes this work for a returning
  // customer whose account was linked to their old orders after they signed up:
  // nothing was ever put in their localStorage, so the banner could not appear
  // however many parcels we had shipped them.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHOPIFY_ADDRESS_SUGGESTION_KEY);
      if (raw) setSuggestion(JSON.parse(raw));
    } catch {}
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReal, dismissed]);

  function dismissSuggestion() {
    localStorage.removeItem(SHOPIFY_ADDRESS_SUGGESTION_KEY);
    setSuggestion(null);
    setDismissed(true);
  }

  /** Hands the draft to the new-address form, which prefills from this key. */
  function useSuggestion() {
    try {
      localStorage.setItem(SHOPIFY_ADDRESS_SUGGESTION_KEY, JSON.stringify(suggestion));
    } catch {}
  }

  function load() {
    fetch("/api/account/addresses")
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
    await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    setBusyId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("ลบที่อยู่นี้?")) return;
    setBusyId(id);
    await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    setBusyId(null);
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-ink mb-2">ที่อยู่จัดส่ง</h1>
      <p className="text-sm text-slate-500 mb-6">จัดการที่อยู่สำหรับจัดส่งสินค้าของคุณ</p>

      {!isReal && (
        <div className="mb-6">
          <DemoBadge text="สมุดที่อยู่ผูกกับบัญชีจริง (Email) เท่านั้นตอนนี้ — เข้าสู่ระบบด้วยอีเมลเพื่อบันทึกที่อยู่จริงลงฐานข้อมูล" />
        </div>
      )}

      {/* Shown whether or not the book is empty: a customer who saved a work
          address is exactly the one who still needs their home one offered.
          The API withholds it once it is actually in the book. */}
      {isReal && suggestion && (
        <div className="mb-6 rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-brand-ink">ที่อยู่จากคำสั่งซื้อที่ผ่านมาของคุณ</p>
              {suggestion.recipient_name && (
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  {suggestion.recipient_name}
                  {suggestion.phone ? ` · ${suggestion.phone}` : ""}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-0.5">
                {suggestion.address_line}
                {suggestion.subdistrict ? ` แขวง/ตำบล${suggestion.subdistrict}` : ""}
                {suggestion.district ? ` ${suggestion.district}` : ""}
                {suggestion.province ? ` ${suggestion.province}` : ""} {suggestion.postal_code}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {suggestion.missing && suggestion.missing.length > 0
                  ? `กรุณาตรวจสอบและกรอก${suggestion.missing.join(" / ")}ให้ครบก่อนบันทึก`
                  : "ตรวจสอบความถูกต้องอีกครั้งก่อนบันทึกได้เลย"}
              </p>
              <div className="flex items-center gap-3 mt-2.5">
                <Link
                  href="/account/addresses/new"
                  onClick={useSuggestion}
                  className="text-xs font-semibold text-brand-emerald"
                >
                  ใช้ที่อยู่นี้
                </Link>
                <button onClick={dismissSuggestion} className="text-xs text-slate-400">
                  ไม่ใช้ตอนนี้
                </button>
              </div>
            </div>
            <button onClick={dismissSuggestion} aria-label="ปิด" className="text-slate-300 hover:text-slate-500 shrink-0">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {isReal && addresses === null && <p className="text-sm text-slate-400">กำลังโหลด…</p>}

      {isReal && addresses && (
        <div className="flex flex-col gap-3 mb-5">
          {addresses.length === 0 && (
            <div className="rounded-xl2 border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              ยังไม่มีที่อยู่จัดส่ง
            </div>
          )}
          {addresses.map((a) => (
            <div key={a.id} className="rounded-xl2 border border-slate-100 shadow-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <MapPin size={16} className="text-brand-emerald mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-brand-ink">{a.label}</span>
                      {a.is_default && (
                        <span className="text-[10px] font-semibold text-brand-emerald bg-brand-gradient-soft rounded-full px-2 py-0.5">
                          ค่าเริ่มต้น
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{a.phone}</p>
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
                      href={`/account/addresses/${a.id}/edit`}
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
        href="/account/addresses/new"
        className="flex items-center justify-center gap-2 rounded-xl2 border border-dashed border-slate-200 py-3.5 text-sm font-semibold text-brand-emerald hover:border-brand-teal"
      >
        <Plus size={16} /> เพิ่มที่อยู่ใหม่
      </Link>
    </div>
  );
}

export default function AddressesPage() {
  return (
    <AccountLayout>
      <AddressesContent />
    </AccountLayout>
  );
}

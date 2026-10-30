"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, MapPin, Receipt, ShieldCheck } from "lucide-react";
import GoogleIcon from "@/components/icons/GoogleIcon";
import { channelLabel, type ChannelKey } from "@/lib/account-identities";

// The four settings that used to be their own pages in the sidebar.
//
// Each is a card that answers the question people actually arrive with —
// "is my address still right", "is LINE connected" — and nothing more. The
// page that does the work is still there behind a link, because those pages
// have lists, defaults and delete buttons, and folding all of that in would
// have made one long page out of five short ones rather than one useful one.
//
// Read first, edit on demand: the shopper sees every current value at once
// and opens an editor only when something is wrong. It is the shape every
// store of this size has settled on (lululemon, H&M, Fresha, ZARA).

type Identity = { provider: ChannelKey; masked: string; verifiedAt: string | null };
type Address = {
  id: string;
  label: string | null;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  is_default: boolean;
};
type TaxAddress = { id: string; company_name?: string | null; tax_id?: string | null; is_default: boolean };

const CARD = "rounded-xl2 border border-slate-200 bg-white p-5";
const HEAD = "flex items-center justify-between gap-3";
const TITLE = "flex items-center gap-2 text-sm font-bold text-brand-ink";
const LINK = "text-xs font-semibold text-brand-800 hover:underline";
const ROW = "flex items-center justify-between gap-3 border-t border-slate-100 py-2.5 text-sm";

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        ok ? "bg-brand-gradient-soft text-brand-800" : "bg-slate-100 text-slate-500"
      }`}
    >
      {children}
    </span>
  );
}

export default function SettingsSummary() {
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [taxAddresses, setTaxAddresses] = useState<TaxAddress[] | null>(null);

  useEffect(() => {
    let alive = true;
    // One round trip each, in parallel: three small reads that the page
    // cannot draw without, and nothing here depends on another's answer.
    Promise.all([
      fetch("/api/account/identities").then((r) => r.json()).catch(() => null),
      fetch("/api/account/addresses").then((r) => r.json()).catch(() => null),
      fetch("/api/account/tax-addresses").then((r) => r.json()).catch(() => null),
    ]).then(([ids, addr, tax]) => {
      if (!alive) return;
      setIdentities(Array.isArray(ids?.identities) ? ids.identities : []);
      setAddresses(Array.isArray(addr?.addresses) ? addr.addresses : []);
      setTaxAddresses(Array.isArray(tax?.addresses) ? tax.addresses : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Email and phone have their own cards on this page already, with the
  // OTP flows that change them. Listing them again here would be two places
  // showing the same address and disagreeing the moment one is edited.
  const social = (["google", "line"] as ChannelKey[]).map((key) => ({
    key,
    linked: identities?.some((i) => i.provider === key) ?? false,
  }));

  const defaultAddress = addresses?.find((a) => a.is_default) ?? addresses?.[0] ?? null;
  const taxCount = taxAddresses?.length ?? 0;

  return (
    <>
      <div className={CARD}>
        <div className={HEAD}>
          <p className={TITLE}>
            <ShieldCheck size={16} className="text-brand-800" />
            ช่องทางเข้าสู่ระบบ
          </p>
          <Link href="/account/verify" className={LINK}>
            จัดการ
          </Link>
        </div>
        <p className="mt-1 text-xs text-slate-500">ทุกช่องทางนี้เข้าบัญชีเดียวกัน</p>
        <div className="mt-3">
          {social.map((s) => (
            <div key={s.key} className={ROW}>
              <span className="flex items-center gap-2 text-slate-600">
                {s.key === "google" ? (
                  <GoogleIcon className="h-4 w-4" />
                ) : (
                  <span className="grid h-4 w-4 place-items-center rounded-[4px] bg-[#06C755] text-[8px] font-bold text-white">
                    L
                  </span>
                )}
                {channelLabel(s.key)}
              </span>
              {identities === null ? (
                <span className="h-4 w-16 animate-pulse rounded-full bg-slate-100" />
              ) : s.linked ? (
                <Pill ok>เชื่อมแล้ว</Pill>
              ) : (
                <Link href="/account/verify" className={LINK}>
                  เชื่อม
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}>
          <p className={TITLE}>
            <MapPin size={16} className="text-brand-800" />
            ที่อยู่จัดส่ง
          </p>
          <Link href="/account/addresses" className={LINK}>
            จัดการ
          </Link>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          {addresses === null ? (
            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
          ) : defaultAddress ? (
            <>
              <p className="flex flex-wrap items-center gap-2 font-semibold text-brand-ink">
                {defaultAddress.is_default && <Pill ok>ค่าเริ่มต้น</Pill>}
                {defaultAddress.label || "ที่อยู่จัดส่ง"}
              </p>
              <p className="mt-1 text-slate-500">
                {[
                  defaultAddress.address_line,
                  defaultAddress.subdistrict,
                  defaultAddress.district,
                  defaultAddress.province,
                  defaultAddress.postal_code,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              {addresses.length > 1 && (
                <p className="mt-1 text-xs text-slate-400">และอีก {addresses.length - 1} ที่อยู่</p>
              )}
            </>
          ) : (
            <p className="text-slate-500">
              ยังไม่มีที่อยู่ —{" "}
              <Link href="/account/addresses/new" className={LINK}>
                เพิ่มที่อยู่
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}>
          <p className={TITLE}>
            <Receipt size={16} className="text-brand-800" />
            ที่อยู่ใบกำกับภาษี
          </p>
          <Link href="/account/tax-addresses" className={LINK}>
            จัดการ
          </Link>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
          {taxAddresses === null ? (
            <div className="h-5 w-40 animate-pulse rounded-lg bg-slate-100" />
          ) : taxCount > 0 ? (
            <p>บันทึกไว้ {taxCount} รายการ</p>
          ) : (
            <p>ยังไม่มี — เพิ่มได้ตอนสั่งซื้อ หรือเพิ่มไว้ล่วงหน้าก็ได้</p>
          )}
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}>
          <div>
            <p className={TITLE}>
              <KeyRound size={16} className="text-brand-800" />
              รหัสผ่าน
            </p>
            <p className="mt-1 text-xs text-slate-500">ใช้คู่กับอีเมลตอนเข้าสู่ระบบ</p>
          </div>
          <Link
            href="/account/change-password"
            className="shrink-0 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-brand-ink hover:bg-slate-50"
          >
            เปลี่ยน
          </Link>
        </div>
      </div>
    </>
  );
}

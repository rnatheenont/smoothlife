"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui";
import LoginChannels from "@/components/account/LoginChannels";
import { KeyRound, ShieldCheck } from "lucide-react";
import GoogleIcon from "@/components/icons/GoogleIcon";
import { channelLabel, type ChannelKey } from "@/lib/account-identities";

// The two settings that are a state rather than a list: which services this
// account can be signed in with, and whether it has a password.
//
// The address books sit beside this in their own cards, because those are
// lists that get edited in place (AddressBookCard, TaxAddressBookCard).
// Linking a Google or LINE account is a redirect out to that provider and
// back, so it stays on /account/verify, where the merge decision it can
// raise also lives.

type Identity = { provider: ChannelKey; masked: string; verifiedAt: string | null };

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
  const [channelsOpen, setChannelsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/identities")
      .then((r) => r.json())
      .catch(() => null)
      .then((ids) => {
        if (!alive) return;
        setIdentities(Array.isArray(ids?.identities) ? ids.identities : []);
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

  return (
    <>
      <div className={CARD}>
        <div className={HEAD}>
          <p className={TITLE}>
            <ShieldCheck size={16} className="text-brand-800" />
            ช่องทางเข้าสู่ระบบ
          </p>
          <button type="button" onClick={() => setChannelsOpen(true)} className={LINK}>
            จัดการ
          </button>
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
                <button type="button" onClick={() => setChannelsOpen(true)} className={LINK}>
                  เชื่อม
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={channelsOpen}
        onClose={() => setChannelsOpen(false)}
        title="ช่องทางเข้าสู่ระบบ"
        description="เข้าสู่ระบบด้วยช่องทางไหนก็ได้ แล้วมาที่บัญชีเดียวกัน"
        size="lg"
      >
        <LoginChannels embedded />
      </Modal>

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

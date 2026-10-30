"use client";

import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import LoginChannels from "@/components/account/LoginChannels";

// Two settings that are a state rather than a list: what this account can be
// signed in with, and whether it has a password.
//
// The channels used to be a summary with a "จัดการ" link that opened the real
// list in a dialog — two renderings of the same four rows, one of which could
// not do anything. Now the real list is simply here, with the verify and link
// buttons it has always had.
//
// /account/verify still exists and still renders the same component, because
// a Google or LINE link leaves the site, and the account-merge decision it
// can raise comes back to a page — not to a dialog that closed the moment
// the tab navigated away.

const CARD = "rounded-xl2 border border-slate-200 bg-white p-5";
const TITLE = "flex items-center gap-2 text-sm font-bold text-brand-ink";

export default function SettingsSummary() {
  return (
    <>
      <div className={CARD}>
        <p className={TITLE}>
          <ShieldCheck size={16} className="text-brand-800" />
          ช่องทางเข้าสู่ระบบ
        </p>
        <p className="mt-1 mb-3 text-xs text-slate-500">ทุกช่องทางนี้เข้าบัญชีเดียวกัน</p>
        <LoginChannels embedded />
      </div>

      <div className={CARD}>
        <div className="flex items-center justify-between gap-3">
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCheck, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AccountLayout from "@/components/account/AccountLayout";
import AccountOverview from "@/components/account/AccountOverview";

const PROFILE_BANNER_DISMISSED_KEY = "sl_profile_banner_dismissed";

// Catches everyone who never went through the (newer) phone-required signup
// form — old accounts, and LINE sign-ins, which have no form step for us to
// require it on at all. Dismissible rather than blocking, since forcing it
// would lock people who are otherwise using the site fine.
function ProfileCompletionBanner() {
  const { user } = useAuth();
  const isReal = user?.real;
  const [hasAddress, setHasAddress] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && localStorage.getItem(PROFILE_BANNER_DISMISSED_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!isReal) return;
    fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((data) => setHasAddress((data.addresses || []).length > 0))
      .catch(() => setHasAddress(true));
  }, [isReal]);

  if (!isReal || dismissed || hasAddress === null) return null;
  const missingPhone = !user.phone;
  const missingAddress = !hasAddress;
  if (!missingPhone && !missingAddress) return null;

  function dismiss() {
    localStorage.setItem(PROFILE_BANNER_DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="mb-6 rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft p-4 flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
        <UserCheck size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-brand-ink">กรอกข้อมูลให้ครบเพื่อรับสิทธิ์เต็มรูปแบบ</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {missingPhone && missingAddress
            ? "ยังไม่มีเบอร์โทรศัพท์และที่อยู่จัดส่งในระบบ"
            : missingPhone
            ? "ยังไม่มีเบอร์โทรศัพท์ในระบบ"
            : "ยังไม่มีที่อยู่จัดส่งในระบบ"}
        </p>
        <div className="flex items-center gap-3 mt-2.5">
          {missingPhone && (
            <Link href="/account/profile" className="text-xs font-semibold text-brand-800">
              เพิ่มเบอร์โทร
            </Link>
          )}
          {missingAddress && (
            <Link href="/account/addresses/new" className="text-xs font-semibold text-brand-800">
              เพิ่มที่อยู่
            </Link>
          )}
        </div>
      </div>
      <button onClick={dismiss} aria-label="ปิด" className="text-slate-300 hover:text-slate-500 shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

function AccountDashboard() {
  return (
    <div>
      <h1 className="sr-only">บัญชีของฉัน</h1>

      <ProfileCompletionBanner />

      <AccountOverview />
    </div>
  );
}

export default function AccountPage() {
  return (
    <AccountLayout>
      <AccountDashboard />
    </AccountLayout>
  );
}

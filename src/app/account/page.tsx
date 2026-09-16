"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ScanFace, UserCheck, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AccountLayout from "@/components/account/AccountLayout";
import AccountOverview from "@/components/account/AccountOverview";
import { formatScanDate, useScanHistory } from "@/components/skin-coach/ScanHistory";
import { careAreas, scanScore } from "@/lib/skin-scan-summary";
import { healthBand } from "@/lib/skin-analysis";

function SkinScanSummaryCard() {
  const { scans, loaded } = useScanHistory();
  if (!loaded) return null;
  const latest = scans[0];
  if (!latest) {
    return (
      <Link href="/skin-coach" className="rounded-xl2 border border-slate-100 shadow-card p-5 flex items-center gap-3 group">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
          <ScanFace size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-brand-ink">ยังไม่มีผลสแกนผิว</p>
          <p className="text-xs text-slate-500">สแกนผิวฟรี แล้วกดบันทึกผล เพื่อกลับมาดูและเทียบพัฒนาการได้</p>
        </div>
        <ChevronRight size={16} className="text-slate-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    );
  }
  const score = scanScore(latest);
  const band = healthBand(score);
  const care = careAreas(latest, 2);
  return (
    <Link href="/account/skin-scans" className="rounded-xl2 border border-slate-100 shadow-card p-5 flex items-center gap-4 group">
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-mist">
        {latest.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={latest.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-brand-800/60">
            <ScanFace size={24} />
          </span>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">
          ผลล่าสุด {formatScanDate(latest.scanned_at)} · บันทึกไว้ {scans.length} ครั้ง
        </p>
        <p className="text-sm font-bold text-brand-ink">
          คะแนนผิว <span style={{ color: band.color }}>{score}</span> · อายุผิว {latest.skin_age} ปี
        </p>
        <p className="text-xs text-slate-500 truncate">
          {care.length ? `ควรดูแล: ${care.map((a) => a.label).join(", ")}` : "ทุกด้านอยู่ในเกณฑ์ดี"}
        </p>
      </div>
      <span className="hidden sm:inline text-xs font-semibold text-brand-800 shrink-0">ดูทั้งหมด</span>
      <ChevronRight size={16} className="text-slate-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

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

      <h2 className="mb-3 mt-8 text-sm font-bold text-brand-ink">ผลสแกนผิวของฉัน</h2>
      <SkinScanSummaryCard />
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

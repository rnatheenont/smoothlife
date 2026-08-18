"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, MapPin, Receipt, Plus, ChevronRight, ShieldCheck, Package, Heart, Camera, LogOut, UserCheck, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AccountLayout from "@/components/account/AccountLayout";
import RewardsOverviewCard from "@/components/account/RewardsOverviewCard";
import type { AddressRow } from "@/app/api/account/addresses/route";
import type { TaxAddressRow } from "@/app/api/account/tax-addresses/route";

const genderLabel: Record<string, string> = { male: "ชาย", female: "หญิง", other: "อื่นๆ" };

function formatThaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

// Name/avatar/email already appear big on the membership card above this —
// repeating them here in an identical header just duplicates the same
// identity block twice on one screen, so this stays to the fields that
// aren't shown anywhere else yet.
function ProfileCard() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
      <h2 className="text-sm font-bold text-brand-ink mb-3">ข้อมูลส่วนตัว</h2>

      <div className="flex flex-col gap-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">อีเมล</span>
          <span className="text-brand-ink font-medium">{user.email || "-"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">เบอร์โทรศัพท์</span>
          <span className="text-brand-ink font-medium">{user.phone || "-"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">เพศ</span>
          <span className="text-brand-ink font-medium">{user.gender ? genderLabel[user.gender] : "-"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">วันเกิด</span>
          <span className="text-brand-ink font-medium">{user.birthdate ? formatThaiDate(user.birthdate) : "-"}</span>
        </div>
      </div>

      <Link
        href="/account/profile"
        className="flex items-center gap-1.5 text-sm font-semibold text-brand-emerald mt-3.5 border-t border-slate-100 pt-3.5"
      >
        <Pencil size={13} /> แก้ไขโปรไฟล์
      </Link>
    </div>
  );
}

function AddressSummaryCard() {
  const { user } = useAuth();
  const isReal = user?.real;
  const [addr, setAddr] = useState<AddressRow | null | undefined>(undefined);

  useEffect(() => {
    if (!isReal) return setAddr(null);
    fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((data) => setAddr(data.addresses?.[0] || null));
  }, [isReal]);

  return (
    <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
      <h2 className="text-sm font-bold text-brand-ink mb-3">ที่อยู่จัดส่ง</h2>
      {addr && (
        <Link href="/account/addresses" className="flex items-start justify-between gap-3 group">
          <div className="text-sm text-slate-600 leading-relaxed">
            <span className="font-semibold text-brand-ink">{addr.label}</span>
            <span className="text-slate-400"> · {addr.phone}</span>
            <p className="mt-0.5">{addr.recipient_name}</p>
            <p>
              {addr.address_line} แขวง/ตำบล{addr.subdistrict}
              <br />
              เขต/อำเภอ{addr.district} จ.{addr.province} {addr.postal_code}
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
      {addr === null && <p className="text-sm text-slate-400 mb-2">ยังไม่มีที่อยู่จัดส่ง</p>}
      <Link
        href="/account/addresses/new"
        className="flex items-center gap-1.5 text-sm font-semibold text-brand-emerald mt-3.5 border-t border-slate-100 pt-3.5"
      >
        <Plus size={14} /> เพิ่มที่อยู่ใหม่
      </Link>
    </div>
  );
}

function TaxAddressSummaryCard() {
  const { user } = useAuth();
  const isReal = user?.real;
  const [addr, setAddr] = useState<TaxAddressRow | null | undefined>(undefined);

  useEffect(() => {
    if (!isReal) return setAddr(null);
    fetch("/api/account/tax-addresses")
      .then((r) => r.json())
      .then((data) => setAddr(data.addresses?.[0] || null));
  }, [isReal]);

  return (
    <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
      <h2 className="text-sm font-bold text-brand-ink mb-3">ที่อยู่ใบกำกับภาษี</h2>
      {addr ? (
        <Link href="/account/tax-addresses" className="flex items-start justify-between gap-3 group">
          <div className="text-sm text-slate-600 leading-relaxed">
            <span className="font-semibold text-brand-ink">{addr.recipient_name}</span>
            <p className="mt-0.5">เลขผู้เสียภาษี {addr.tax_id}</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      ) : (
        <p className="text-sm text-slate-400">ยังไม่มีที่อยู่ใบกำกับภาษี</p>
      )}
      <Link
        href="/account/tax-addresses/new"
        className="flex items-center gap-1.5 text-sm font-semibold text-brand-emerald mt-3.5 border-t border-slate-100 pt-3.5"
      >
        <Plus size={14} /> เพิ่มที่อยู่ใหม่
      </Link>
    </div>
  );
}

function ChangePasswordCard() {
  return (
    <Link href="/account/change-password" className="rounded-xl2 border border-slate-100 shadow-card p-5 flex items-center gap-3 group">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald">
        <ShieldCheck size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-brand-ink">เปลี่ยนรหัสผ่าน</p>
        <p className="text-xs text-slate-400">ยืนยันตัวตนผ่านอีเมลก่อนตั้งรหัสผ่านใหม่</p>
      </div>
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
            <Link href="/account/profile" className="text-xs font-semibold text-brand-emerald">
              เพิ่มเบอร์โทร
            </Link>
          )}
          {missingAddress && (
            <Link href="/account/addresses/new" className="text-xs font-semibold text-brand-emerald">
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
  const { user, logout } = useAuth();
  const router = useRouter();
  const [orderCount, setOrderCount] = useState<number | null>(null);

  function handleLogout() {
    logout();
    router.push("/");
  }

  useEffect(() => {
    fetch("/api/account/orders")
      .then((r) => r.json())
      .then((data) => setOrderCount(Array.isArray(data.orders) ? data.orders.length : 0))
      .catch(() => setOrderCount(0));
  }, []);

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink mb-6">บัญชีของฉัน</h1>

      <ProfileCompletionBanner />

      <div className="mb-8">
        <RewardsOverviewCard />
      </div>

      <h2 className="text-sm font-bold text-brand-ink mb-3">ข้อมูลส่วนตัวและที่อยู่</h2>
      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <ProfileCard />
        <div className="flex flex-col gap-5">
          <AddressSummaryCard />
          <TaxAddressSummaryCard />
        </div>
      </div>

      <h2 className="text-sm font-bold text-brand-ink mb-3">ความปลอดภัย</h2>
      <div className="mb-8">
        <ChangePasswordCard />
      </div>

      <h2 className="text-sm font-bold text-brand-ink mb-3">เมนูลัด</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link href="/account/orders" className="flex flex-col items-start gap-2.5 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card hover:border-brand-teal transition-colors">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald"><Package size={18} /></div>
          <span className="text-sm font-semibold text-brand-ink">คำสั่งซื้อ{orderCount !== null ? ` (${orderCount})` : ""}</span>
        </Link>
        <Link href="/account/wishlist" className="flex flex-col items-start gap-2.5 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card hover:border-brand-teal transition-colors">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald"><Heart size={18} /></div>
          <span className="text-sm font-semibold text-brand-ink">รายการโปรด</span>
        </Link>
        <Link href="/skin-coach" className="flex flex-col items-start gap-2.5 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card hover:border-brand-teal transition-colors">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald"><Camera size={18} /></div>
          <span className="text-sm font-semibold text-brand-ink">Skin Coach</span>
        </Link>
      </div>

      <button
        onClick={handleLogout}
        className="lg:hidden flex w-full items-center justify-center gap-2 rounded-xl2 border border-rose-200 py-3 text-sm font-semibold text-rose-500 mt-8"
      >
        <LogOut size={16} />
        ออกจากระบบ
      </button>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, MapPin, Receipt, Plus, ChevronRight, ShieldCheck, Package, Heart, Award, Camera } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AccountLayout from "@/components/account/AccountLayout";
import type { AddressRow } from "@/app/api/account/addresses/route";
import type { TaxAddressRow } from "@/app/api/account/tax-addresses/route";

const genderLabel: Record<string, string> = { male: "ชาย", female: "หญิง", other: "อื่นๆ" };

function formatThaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

function ProfileCard() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-gradient text-white text-lg font-bold overflow-hidden">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-brand-ink truncate">{user.name}</p>
          <p className="text-xs text-slate-400 truncate">{user.email || "ยังไม่ได้ผูกอีเมล"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 text-sm border-t border-slate-100 pt-3.5">
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
        className="flex items-center justify-center gap-1.5 mt-4 text-sm font-semibold text-brand-emerald"
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

function AccountDashboard() {
  const { user, getOrders } = useAuth();
  if (!user) return null;
  const orders = getOrders();

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink mb-6">บัญชีของฉัน</h1>

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <ProfileCard />
        <div className="flex flex-col gap-5">
          <AddressSummaryCard />
          <TaxAddressSummaryCard />
        </div>
      </div>

      <div className="mb-8">
        <ChangePasswordCard />
      </div>

      <h2 className="text-sm font-bold text-brand-ink mb-3">เมนูลัด</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/account/orders" className="flex flex-col items-start gap-2.5 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card hover:border-brand-teal transition-colors">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald"><Package size={18} /></div>
          <span className="text-sm font-semibold text-brand-ink">คำสั่งซื้อ ({orders.length})</span>
        </Link>
        <Link href="/account/points" className="flex flex-col items-start gap-2.5 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card hover:border-brand-teal transition-colors">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald"><Award size={18} /></div>
          <span className="text-sm font-semibold text-brand-ink">{user.points} คะแนน</span>
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

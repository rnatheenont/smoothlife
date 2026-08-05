"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function AccountGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="container-page py-20 text-center text-slate-400">กำลังโหลด...</div>;

  if (!user) {
    return (
      <div className="container-page py-20 text-center max-w-md mx-auto">
        <h1 className="text-xl font-bold text-brand-ink">กรุณาเข้าสู่ระบบ</h1>
        <p className="text-sm text-slate-500 mt-2">เข้าสู่ระบบเพื่อดูข้อมูลบัญชีของคุณ</p>
        <Link href="/account/login" className="inline-block mt-6 rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

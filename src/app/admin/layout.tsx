"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Gift, SlidersHorizontal, Award, LogOut, CreditCard, MessageSquareText, Repeat, Receipt, Inbox, LayoutDashboard, MessageCircle } from "lucide-react";

const NAV = [
  { href: "/admin", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/admin/inbox", label: "กล่องข้อความ", icon: Inbox },
  { href: "/admin/free-gifts", label: "โปรโมชั่น", icon: Gift },
  { href: "/admin/free-gifts/widgets", label: "Widgets", icon: SlidersHorizontal },
  { href: "/admin/points", label: "คะแนน", icon: Award },
  { href: "/admin/reviews", label: "รีวิวรออนุมัติ", icon: MessageSquareText },
  { href: "/admin/gift-cards", label: "บัตรของขวัญ", icon: CreditCard },
  { href: "/admin/subscription-products", label: "สินค้าสมัครสมาชิก", icon: Repeat },
  { href: "/admin/checkout-transactions", label: "รายการซื้อ (2C2P)", icon: Receipt },
  { href: "/admin/line-rich-menu", label: "เมนู LINE OA", icon: MessageCircle },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  async function checkAuth() {
    const res = await fetch("/api/admin/me");
    setAuthed(res.ok);
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!data.ok) {
      setLoginError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    setPassword("");
    setAuthed(true);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  if (authed === null) {
    return <div className="container-page py-16 text-center text-sm text-slate-400">กำลังโหลด...</div>;
  }

  if (authed === false) {
    return (
      <div className="container-page py-16 max-w-sm mx-auto">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-gradient-soft mb-3">
            <Lock size={20} className="text-brand-emerald" />
          </div>
          <h1 className="text-lg font-bold text-brand-ink">ระบบจัดการหลังบ้าน</h1>
          <p className="text-xs text-slate-400 mt-1">หน้านี้สำหรับทีมงานเท่านั้น กรอกรหัสผ่านเพื่อเข้าใช้งาน</p>
        </div>
        <form onSubmit={submitLogin} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่านแอดมิน"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-teal"
            autoFocus
          />
          {loginError && <p className="text-xs text-rose-500">{loginError}</p>}
          <button type="submit" className="w-full rounded-full bg-brand-gradient text-white text-sm font-semibold py-2.5">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container-page py-8 md:py-10">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <aside className="md:w-52 shrink-0">
          <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                // "/admin" is a prefix of every admin route, and
                // "/admin/free-gifts" is a prefix of the widgets route — an
                // exact match is the only correct test for both.
                (item.href !== "/admin" && item.href !== "/admin/free-gifts" && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active ? "bg-brand-gradient-soft text-brand-emerald" : "text-slate-500 hover:bg-surface-soft"
                  }`}
                >
                  <Icon size={16} /> {item.label}
                </Link>
              );
            })}
          </div>
          <button
            onClick={logout}
            className="hidden md:flex items-center gap-2 mt-6 text-xs text-slate-400 hover:text-slate-600"
          >
            <LogOut size={13} /> ออกจากระบบ
          </button>
        </aside>
        <div className="flex-1 min-w-0 max-w-3xl">
          {children}
          <button onClick={logout} className="md:hidden flex items-center gap-2 mt-8 text-xs text-slate-400">
            <LogOut size={13} /> ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}

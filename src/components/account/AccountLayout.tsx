"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, User, MapPin, Receipt, Package, Award, Heart, KeyRound, LogOut, CalendarCheck, Trophy } from "lucide-react";
import AccountGate from "@/components/AccountGate";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/account", label: "ภาพรวม", icon: LayoutGrid },
  { href: "/account/profile", label: "โปรไฟล์", icon: User },
  { href: "/account/addresses", label: "ที่อยู่จัดส่ง", icon: MapPin },
  { href: "/account/tax-addresses", label: "ที่อยู่ใบกำกับภาษี", icon: Receipt },
  { href: "/account/orders", label: "คำสั่งซื้อ", icon: Package },
  { href: "/account/checkin", label: "เช็กอินรายวัน", icon: CalendarCheck },
  { href: "/account/points", label: "คะแนนสะสม", icon: Award },
  { href: "/account/leaderboard", label: "อันดับ", icon: Trophy },
  { href: "/account/wishlist", label: "รายการโปรด", icon: Heart },
  { href: "/account/change-password", label: "เปลี่ยนรหัสผ่าน", icon: KeyRound },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(href + "/");
}

function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <div className="container-page py-6 md:py-10 max-w-6xl mx-auto">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 flex flex-col gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-brand-gradient-soft text-brand-emerald" : "text-slate-600 hover:bg-surface-soft"
                  }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50 mt-2"
            >
              <LogOut size={16} />
              ออกจากระบบ
            </button>
          </nav>
        </aside>

        {/* Mobile: horizontal scroll tab bar */}
        <nav className="lg:hidden -mx-4 px-4 mb-5 flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active ? "border-brand-teal bg-brand-gradient-soft text-brand-emerald" : "border-slate-200 text-slate-500"
                }`}
              >
                <item.icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

// Wraps AccountGate itself so every page under /account just does:
//   export default function Page() { return <AccountLayout><Content /></AccountLayout>; }
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <AccountGate>
      <AccountShell>{children}</AccountShell>
    </AccountGate>
  );
}

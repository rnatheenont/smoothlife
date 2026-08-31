"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  User,
  MapPin,
  Receipt,
  Package,
  Award,
  Heart,
  KeyRound,
  LogOut,
  CalendarCheck,
  Trophy,
  Repeat,
  Users,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import AccountGate from "@/components/AccountGate";
import { useAuth } from "@/lib/auth-context";
import { REWARDS_ACTIVITIES_ENABLED } from "@/lib/feature-flags";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label?: string; items: NavItem[] };

// Grouped so 11 flat links become "the one you land on" + 3 scannable
// clusters instead of one long undifferentiated list — profile/address/
// password (account info), orders/subscriptions/wishlist (buying), and
// checkin/points/leaderboard (engagement) are each their own kind of task.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/account", label: "ภาพรวม", icon: LayoutGrid }],
  },
  {
    label: "บัญชีของฉัน",
    items: [
      { href: "/account/profile", label: "โปรไฟล์", icon: User },
      { href: "/account/addresses", label: "ที่อยู่จัดส่ง", icon: MapPin },
      { href: "/account/tax-addresses", label: "ที่อยู่ใบกำกับภาษี", icon: Receipt },
      { href: "/account/change-password", label: "เปลี่ยนรหัสผ่าน", icon: KeyRound },
    ],
  },
  {
    label: "การสั่งซื้อของฉัน",
    items: [
      { href: "/account/orders", label: "คำสั่งซื้อ", icon: Package },
      { href: "/account/subscriptions", label: "การสมัครของฉัน", icon: Repeat },
      { href: "/account/wishlist", label: "รายการโปรด", icon: Heart },
      { href: "/account/reviews", label: "รีวิวของฉัน", icon: MessageSquareText },
    ],
  },
  {
    items: [{ href: "/account/referral", label: "แนะนำเพื่อน", icon: Users }],
  },
  ...(REWARDS_ACTIVITIES_ENABLED
    ? [
        {
          label: "กิจกรรมและรางวัล",
          items: [
            { href: "/account/checkin", label: "เช็กอินรายวัน", icon: CalendarCheck },
            { href: "/account/points", label: "คะแนนสะสม", icon: Award },
            { href: "/account/leaderboard", label: "อันดับ", icon: Trophy },
          ],
        },
      ]
    : []),
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);

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
            {NAV_GROUPS.map((group, i) => (
              <div key={group.label ?? `group-${i}`} className={i > 0 ? "mt-4 pt-4 border-t border-slate-100" : undefined}>
                {group.label && (
                  <p className="px-3.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                )}
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
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
                </div>
              </div>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50 mt-2"
            >
              <LogOut size={16} />
              ออกจากระบบ
            </button>
          </nav>
        </aside>

        {/* Mobile: horizontal scroll tab bar — grouped items stay adjacent,
            with a thin divider between clusters so the grouping still reads
            even without room for group labels in a single scroll row. */}
        <nav className="lg:hidden -mx-4 px-4 mb-5 flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label ?? `group-${i}`} className="flex shrink-0 items-center gap-2">
              {i > 0 && <span className="h-5 w-px shrink-0 bg-slate-200" />}
              {group.items.map((item) => {
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
            </div>
          ))}
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

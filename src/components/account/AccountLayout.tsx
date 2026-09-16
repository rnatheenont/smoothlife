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
  ScanFace,
  type LucideIcon,
} from "lucide-react";
import AccountGate from "@/components/AccountGate";
import { useAuth } from "@/lib/auth-context";
import { DAILY_CHECKIN_ENABLED, REWARDS_ACTIVITIES_ENABLED } from "@/lib/feature-flags";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label?: string; items: NavItem[] };

// One group per kind of task, in the order people ask for them: what I
// bought, what I get for buying, the skin service, then the settings nobody
// opens twice. Everything a flat list used to bury three rows apart —
// wishlist next to orders, referrals next to points — now sits together.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/account", label: "ภาพรวม", icon: LayoutGrid }],
  },
  {
    label: "การซื้อของฉัน",
    items: [
      { href: "/account/orders", label: "คำสั่งซื้อ", icon: Package },
      { href: "/account/subscriptions", label: "สมัครรายเดือน", icon: Repeat },
      { href: "/account/reviews", label: "รีวิวของฉัน", icon: MessageSquareText },
      { href: "/account/wishlist", label: "รายการโปรด", icon: Heart },
    ],
  },
  {
    label: "สิทธิประโยชน์",
    items: [
      ...(REWARDS_ACTIVITIES_ENABLED
        ? [
            { href: "/account/points", label: "คะแนนสะสม", icon: Award },
            ...(DAILY_CHECKIN_ENABLED
              ? [{ href: "/account/checkin", label: "เช็กอินรายวัน", icon: CalendarCheck }]
              : []),
            { href: "/account/leaderboard", label: "อันดับ", icon: Trophy },
          ]
        : []),
      { href: "/account/referral", label: "แนะนำเพื่อน", icon: Users },
    ],
  },
  {
    label: "บริการดูแลผิว",
    items: [{ href: "/account/skin-scans", label: "ผลสแกนผิว", icon: ScanFace }],
  },
  {
    label: "ตั้งค่าบัญชี",
    items: [
      { href: "/account/profile", label: "ข้อมูลส่วนตัว", icon: User },
      { href: "/account/addresses", label: "ที่อยู่จัดส่ง", icon: MapPin },
      { href: "/account/tax-addresses", label: "ที่อยู่ใบกำกับภาษี", icon: Receipt },
      { href: "/account/change-password", label: "เปลี่ยนรหัสผ่าน", icon: KeyRound },
    ],
  },
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
    // A tinted page behind white cards: on plain white the cards' only edge
    // was a hairline border, so they read as sections of one flat page.
    <div className="min-h-[70vh] bg-surface-soft">
      <div className="container-page py-6 md:py-10 max-w-6xl mx-auto">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 flex flex-col gap-1">
            {NAV_GROUPS.map((group, i) => (
              <div key={group.label ?? `group-${i}`} className={i > 0 ? "mt-4 pt-4 border-t border-surface-line" : undefined}>
                {group.label && (
                  <p className="px-3.5 mb-1.5 text-[11px] font-bold text-slate-500">
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
                          active ? "bg-surface-mist font-semibold text-brand-ink" : "text-slate-600 hover:bg-surface-mist/60 hover:text-brand-ink"
                        }`}
                        aria-current={active ? "page" : undefined}
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
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 mt-2"
            >
              <LogOut size={16} />
              ออกจากระบบ
            </button>
          </nav>
        </aside>

        {/* Mobile: horizontal scroll tab bar — grouped items stay adjacent,
            with a thin divider between clusters so the grouping still reads
            even without room for group labels in a single scroll row. The
            overview page is itself the menu on a phone, so the chips would
            only repeat what is already on screen. */}
        <nav className={`${pathname === "/account" ? "hidden" : "lg:hidden"} -mx-4 px-4 mb-5 flex items-center gap-2 overflow-x-auto scrollbar-none pb-1`}>
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
                      active ? "border-brand-action bg-brand-action text-white" : "border-surface-line text-slate-600"
                    }`}
                    aria-current={active ? "page" : undefined}
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

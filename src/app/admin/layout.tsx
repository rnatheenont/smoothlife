"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Lock,
  Gift,
  SlidersHorizontal,
  Award,
  LogOut,
  CreditCard,
  MessageSquareText,
  Repeat,
  Receipt,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Palette,
  Search,
  Store,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui";

// Grouped the way the work is grouped — orders, then selling, then the
// content and the system settings — so fourteen entries read as four short
// lists instead of one long one.
const NAV_GROUPS = [
  {
    label: "",
    items: [{ href: "/admin", label: "ภาพรวม", icon: LayoutDashboard }],
  },
  {
    label: "ออเดอร์ & ลูกค้า",
    items: [
      { href: "/admin/inbox", label: "กล่องข้อความ", icon: Inbox },
      { href: "/admin/tracking-sync", label: "ซิงก์เลขพัสดุ", icon: Truck },
      { href: "/admin/customers", label: "ลูกค้า & ผูกบัญชี", icon: Users },
      { href: "/admin/checkout-transactions", label: "รายการซื้อ (2C2P)", icon: Receipt },
    ],
  },
  {
    label: "การขาย & โปรโมชั่น",
    items: [
      { href: "/admin/flash-sale", label: "Flash Sale", icon: Zap },
      { href: "/admin/free-gifts", label: "โปรโมชั่น", icon: Gift },
      { href: "/admin/free-gifts/widgets", label: "Widgets", icon: SlidersHorizontal },
      { href: "/admin/gift-cards", label: "บัตรของขวัญ", icon: CreditCard },
      { href: "/admin/subscription-products", label: "สินค้าสมัครสมาชิก", icon: Repeat },
      { href: "/admin/points", label: "คะแนน", icon: Award },
    ],
  },
  {
    label: "เนื้อหา & ระบบ",
    items: [
      { href: "/admin/reviews", label: "รีวิวรออนุมัติ", icon: MessageSquareText },
      { href: "/admin/line-rich-menu", label: "เมนู LINE OA", icon: MessageCircle },
      { href: "/admin/design", label: "ระบบดีไซน์", icon: Palette },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** "/admin" prefixes every route, and "/admin/free-gifts" prefixes the widgets
 *  route — an exact match is the only correct test for both. */
function isActive(href: string, pathname: string | null) {
  if (href === "/admin" || href === "/admin/free-gifts") return pathname === href;
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [navQuery, setNavQuery] = useState("");

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
    return <div className="container-page py-16 text-center text-sm text-slate-400">กำลังโหลด…</div>;
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-hidden focus:border-brand-teal"
            autoFocus
          />
          {loginError && <p className="text-xs text-rose-500">{loginError}</p>}
          <Button fullWidth type="submit">
            เข้าสู่ระบบ
          </Button>
        </form>
      </div>
    );
  }

  const current = ALL_ITEMS.find((item) => isActive(item.href, pathname));
  const query = navQuery.trim().toLowerCase();
  const groups = query
    ? [{ label: "ผลการค้นหา", items: ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(query)) }]
    : NAV_GROUPS;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 md:px-6 lg:flex-row lg:gap-8 lg:py-8">
      <aside className="lg:w-60 lg:shrink-0">
        {/* The menu stays put while a long page scrolls, and scrolls on its
            own if it ever outgrows the window. */}
        <div className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
          <p className="hidden text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">หลังบ้าน</p>
          <div className="relative mt-3 hidden lg:block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="ค้นหาเมนู"
              aria-label="ค้นหาเมนู"
              className="min-h-9 w-full rounded-xl border border-surface-line bg-white pl-8 pr-3 text-sm text-brand-ink focus:border-brand-800 focus:outline-none"
            />
          </div>

          {/* On a phone the menu is one scrollable row of the same links. */}
          <nav className="mt-0 flex gap-1.5 overflow-x-auto pb-2 lg:mt-4 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
            {groups.map((group) => (
              <div key={group.label} className="contents lg:mb-4 lg:block">
                {group.label && (
                  <p className="mb-1.5 hidden px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:block">{group.label}</p>
                )}
                <div className="contents lg:flex lg:flex-col lg:gap-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href, pathname);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                          active ? "bg-brand-gradient-soft text-brand-800" : "text-slate-500 hover:bg-surface-soft hover:text-brand-ink"
                        }`}
                      >
                        <Icon size={16} className="shrink-0" /> {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {groups[0].items.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">ไม่พบเมนูที่ค้นหา</p>}
          </nav>

          <div className="mt-6 hidden flex-col gap-1 border-t border-surface-line pt-4 lg:flex">
            <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 hover:bg-surface-soft hover:text-slate-600">
              <Store size={13} /> ดูหน้าร้าน
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-slate-400 hover:bg-surface-soft hover:text-slate-600"
            >
              <LogOut size={13} /> ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>

      {/* Dashboards (the inbox, the flash-sale console) use every pixel; the
          rest are lists and forms, which stop being readable past ~1400px. */}
      <div className={`min-w-0 flex-1 ${current?.href === "/admin/inbox" || current?.href === "/admin/flash-sale" ? "" : "max-w-[1400px]"} [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-brand-ink`}>
        {current && (
          <p className="mb-3 hidden items-center gap-1.5 text-xs text-slate-400 lg:flex">
            หลังบ้าน <span aria-hidden>/</span> <span className="font-semibold text-slate-500">{current.label}</span>
          </p>
        )}
        {children}
        <button onClick={logout} className="mt-8 flex items-center gap-2 text-xs text-slate-400 lg:hidden">
          <LogOut size={13} /> ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Store,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui";
import { AdminActionButton, AdminActionProvider } from "@/components/admin/header-action";
import CommandPalette from "@/components/admin/command-palette";

const NAV_COLLAPSED_KEY = "admin-nav-collapsed";

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
const groupOf = (href: string) => NAV_GROUPS.find((g) => g.items.some((i) => i.href === href))?.label ?? "";

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
  // The team works on this all day; whether the menu is folded is their choice
  // to make once, not on every visit.
  const [collapsed, setCollapsed] = useState(false);
  // Clicking the header's "ไปที่หน้า…" remounts the palette open; ⌘K toggles it
  // from anywhere.
  const [paletteTick, setPaletteTick] = useState(0);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
    } catch {
      // private mode / blocked storage: the menu simply starts open
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // nothing to do — the choice just will not survive a reload
    }
  }, [collapsed]);

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
    return <div className="grid min-h-screen place-items-center text-sm text-slate-400">กำลังโหลด…</div>;
  }

  if (authed === false) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-soft/50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card ring-1 ring-surface-line md:p-8">
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
      </div>
    );
  }

  const current = ALL_ITEMS.find((item) => isActive(item.href, pathname));
  const query = navQuery.trim().toLowerCase();
  const groups = query
    ? [{ label: "ผลการค้นหา", items: ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(query)) }]
    : NAV_GROUPS;

  const wideContent = current?.href === "/admin/inbox" || current?.href === "/admin/flash-sale";

  return (
    <AdminActionProvider>
      <div className="flex min-h-screen flex-col bg-surface-soft/50">
        {/* The console's own bar: the storefront's header, promo strip and
            footer are not part of this tool (see SiteChrome). */}
        <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-surface-line bg-white px-3 md:h-14 md:gap-3 md:px-4">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
            aria-pressed={collapsed}
            className="hidden size-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-surface-soft hover:text-brand-ink lg:grid"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <Link href="/admin" className="flex shrink-0 items-center gap-2 font-bold text-brand-ink">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-gradient-soft text-brand-800">
              <LayoutDashboard size={15} />
            </span>
            <span className="hidden sm:inline">Smoothlife · หลังบ้าน</span>
          </Link>
          {current && (
            <p className="hidden min-w-0 items-center gap-1.5 text-sm text-slate-400 md:flex">
              <span aria-hidden>/</span> <span className="truncate font-semibold text-slate-600">{current.label}</span>
            </p>
          )}
          <div className="ms-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaletteTick((n) => n + 1)}
              className="hidden items-center gap-2 rounded-xl border border-surface-line px-2.5 py-1.5 text-xs text-slate-400 hover:text-brand-ink md:flex"
            >
              <Search size={13} /> ไปที่หน้า…
              <kbd className="rounded border border-surface-line px-1 py-0.5 text-[10px]">⌘K</kbd>
            </button>
            <Link
              href="/"
              className="hidden size-9 place-items-center rounded-xl text-slate-500 hover:bg-surface-soft hover:text-brand-ink sm:grid"
              aria-label="ดูหน้าร้าน"
              title="ดูหน้าร้าน"
            >
              <Store size={16} />
            </Link>
            <button
              onClick={logout}
              className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-surface-soft hover:text-brand-ink"
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <CommandPalette key={paletteTick} items={ALL_ITEMS.map((i) => ({ ...i, group: groupOf(i.href) }))} openOnMount={paletteTick > 0} />

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside
            className={`shrink-0 border-surface-line bg-white lg:border-r lg:transition-[width] ${collapsed ? "lg:w-[68px]" : "lg:w-[228px]"}`}
          >
            {/* The menu keeps its place while a long page scrolls, and scrolls
                on its own if it ever outgrows the window. */}
            <div className="lg:sticky lg:top-12 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:p-3 lg:pt-4 md:lg:top-14 md:lg:max-h-[calc(100vh-3.5rem)]">
              {!collapsed && (
                <div className="relative mb-3 hidden lg:block">
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
              )}

              {/* On a phone the menu is one scrollable row of the same links. */}
              <nav className="flex gap-1.5 overflow-x-auto border-b border-surface-line bg-white px-3 py-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-0 lg:p-0">
                {groups.map((group) => (
                  <div key={group.label} className="contents lg:mb-4 lg:block">
                    {group.label && !collapsed && (
                      <p className="mb-1.5 hidden px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:block">
                        {group.label}
                      </p>
                    )}
                    {group.label && collapsed && <div className="mx-3 mb-2 hidden border-t border-surface-line lg:block" />}
                    <div className="contents lg:flex lg:flex-col lg:gap-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item.href, pathname);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            title={collapsed ? item.label : undefined}
                            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                              collapsed ? "lg:justify-center lg:px-0" : ""
                            } ${active ? "bg-brand-gradient-soft text-brand-800" : "text-slate-500 hover:bg-surface-soft hover:text-brand-ink"}`}
                          >
                            <Icon size={16} className="shrink-0" />
                            <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {groups[0].items.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">ไม่พบเมนูที่ค้นหา</p>}
              </nav>
            </div>
          </aside>

          {/* Dashboards (the inbox, the flash-sale console) use every pixel;
              the rest are lists and forms, which stop being readable past
              ~1400px. */}
          <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
            {/* A list or a form that stops at 1400px sat against the left
                edge of a 1800px window, with the rest of the workspace empty
                beside it — centred, the page reads as the page. */}
            <div className={wideContent ? "" : "mx-auto w-full max-w-[1400px]"}>
              {/* Where you are, and what this page is for — the page's own
                  title and content follow underneath. */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-5">
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  หลังบ้าน <span aria-hidden>/</span> <span className="font-semibold text-slate-500">{current?.label ?? "ภาพรวม"}</span>
                </p>
                <AdminActionButton />
              </div>
              <div className="[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-brand-ink md:[&_h1]:text-2xl">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </AdminActionProvider>
  );
}

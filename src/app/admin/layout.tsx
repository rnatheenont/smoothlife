"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CreditCard,
  FileText,
  Gift,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageCircle,
  MessageSquareText,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Repeat,
  ScrollText,
  Search,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  AdminActionButton,
  AdminActionProvider,
} from "@/components/admin/header-action";
import CommandPalette from "@/components/admin/command-palette";
import { Button, Input } from "@heroui/react";
import AdminSearch from "@/components/admin/AdminSearch";
import {
  NAV_GROUPS,
  ALL_ITEMS,
  groupOf,
  isAllowed,
  AdminAccessProvider,
} from "@/components/admin/nav-map";

const NAV_COLLAPSED_KEY = "admin-nav-collapsed";

// Grouped the way the work is grouped — orders, then selling, then the
// content and the system settings — so fourteen entries read as four short
// lists instead of one long one.
// Grouped by when the work happens, and named the way the person doing it
// would say it — not after the system behind it. "รายการซื้อ (2C2P)" named a
// payment gateway; "Widgets" named a React concept; "สัญญาณแบรนด์" named
// nothing anyone would search for. The pages did not change, only what the
// menu calls them.
/** One screen for every receipt campaign, so it is named for the kind. The
 *  route matches the address it manages — /admin/campaigns runs the campaigns
 *  customers reach at /campaigns/<key>. */

// How much width a screen actually has content for: a dashboard fills the
// window, a wide data table needs the room, and a list of rows or a form reads
// better in a column than stretched across a 27" monitor.
const FULL_WIDTH = [
  "/admin",
  "/admin/reviews",
  "/admin/gift-cards",
  "/admin/users",
  "/admin/checkout-transactions",
  "/admin/points",
  "/admin/subscription-products",
  "/admin/customers",
  "/admin/free-gifts",
  "/admin/knowledge-base",
  "/admin/line-rich-menu",
  "/admin/flash-sale",
  "/admin/campaigns",
  "/admin/inbox",
  "/admin/seo",
  "/admin/products/content",
  "/admin/brand-insights",
  "/admin/tracking-sync",
];
const WIDE_TABLE: string[] = [];

/** "/admin" prefixes every route, and "/admin/free-gifts" prefixes the widgets
 *  route — an exact match is the only correct test for both. */
function isActive(href: string, pathname: string | null) {
  if (href === "/admin" || href === "/admin/free-gifts")
    return pathname === href;
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [me, setMe] = useState<{
    display_name: string;
    role_key: string;
  } | null>(null);
  // What this role may do, from /api/admin/me. ["*"] until it answers, so the
  // menu does not flicker from empty to full on every load.
  const [permissions, setPermissions] = useState<string[]>(["*"]);
  // How far behind the inbox is. Shown on its menu item so the answer to
  // "is anyone waiting" does not require opening the inbox to find out —
  // which is the one place it was visible before.
  const [unread, setUnread] = useState<{ messages: number; urgent: number }>({
    messages: 0,
    urgent: 0,
  });
  // Signed in with the shared password: there is no person behind this
  // session, so nothing it saves can be attributed to anyone.
  const [sharedLogin, setSharedLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotNote, setForgotNote] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
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
    if (res.ok) {
      // A legacy shared-password session has no personal account to name —
      // `user` comes back null, and the header simply shows no name.
      const data = await res.json().catch(() => null);
      setMe(data?.user ?? null);
      setSharedLogin(data?.shared === true);
      setPermissions(Array.isArray(data?.permissions) ? data.permissions : []);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  // Polled rather than pushed: the inbox already refreshes itself on a timer,
  // and a badge that is a minute stale is still the difference between knowing
  // and having to go and look. Silent on failure — a role without inbox
  // permission gets a 401 here and simply has no badge.
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    const read = async () => {
      try {
        const d = await fetch("/api/admin/inbox/unread").then((r) => r.json());
        if (alive && d?.ok)
          setUnread({ messages: d.messages ?? 0, urgent: d.urgent ?? 0 });
      } catch {
        // leave the last known number up rather than blinking to zero
      }
    };
    read();
    const t = setInterval(read, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [authed, pathname]);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    // A filled-in email switches this to a personal-account login; left
    // blank, it's the original shared password — see /api/admin/login.
    const body = email.trim()
      ? { email: email.trim(), password }
      : { password };
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      setLoginError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    setPassword("");
    setAuthed(true);
    checkAuth();
  }

  // A shared-password session has no account and no inbox, so there is
  // nothing to send — say that instead of pretending to send an email.
  async function requestReset() {
    const to = email.trim();
    if (!to) {
      setForgotNote(
        "รหัสผ่านรวมรีเซ็ตทางอีเมลไม่ได้ เพราะไม่ใช่บัญชี แต่เป็นค่า ADMIN_PANEL_SECRET ที่ตั้งไว้ใน Vercel — ดูหรือเปลี่ยนได้ที่ Settings → Environment Variables",
      );
      return;
    }
    setForgotSending(true);
    setForgotNote("");
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: to }),
      });
      const data = await res.json().catch(() => null);
      setForgotNote(
        data?.message || data?.error || "ส่งคำขอไม่สำเร็จ กรุณาลองใหม่",
      );
    } catch {
      setForgotNote("ส่งคำขอไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setForgotSending(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setMe(null);
  }

  // Setting a new password is the one /admin page that has to work while
  // signed out — the whole reason someone is there is that they cannot sign
  // in. It renders bare: no gate, no menu.
  if (pathname?.startsWith("/admin/reset-password")) {
    return (
      <div className="admin-canvas min-h-screen bg-[#e4ecea] dark:bg-slate-950">
        {children}
      </div>
    );
  }

  if (authed === null) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-400">
        กำลังโหลด…
      </div>
    );
  }

  if (authed === false) {
    return (
      <div className="admin-canvas grid min-h-screen place-items-center bg-[#e4ecea] px-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card ring-1 ring-surface-line md:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-gradient-soft mb-3">
              <Lock size={20} className="text-brand-emerald" />
            </div>
            <h1 className="text-lg font-bold text-brand-ink">
              ระบบจัดการหลังบ้าน
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              หน้านี้สำหรับทีมงานเท่านั้น เข้าด้วยบัญชีส่วนตัวหรือรหัสผ่านรวม
            </p>
          </div>
          <form onSubmit={submitLogin} className="space-y-3">
            <Input
              type="email"
              aria-label="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล (เว้นว่างถ้าใช้รหัสผ่านรวม)"
              autoFocus
            />
            <Input
              type="password"
              aria-label="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                email.trim() ? "รหัสผ่านของคุณ" : "รหัสผ่านแอดมิน (รวม)"
              }
            />
            {loginError && (
              <p className="text-xs text-rose-500">{loginError}</p>
            )}
            <Button fullWidth type="submit">
              เข้าสู่ระบบ
            </Button>
          </form>
          <div className="mt-4 border-t border-surface-line pt-4">
            {!forgotOpen ? (
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="mx-auto block rounded-sm text-xs font-semibold text-brand-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
              >
                ลืมรหัสผ่าน?
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  กรอกอีเมลบัญชีแอดมินของคุณด้านบน แล้วกดส่งลิงก์ ลิงก์มีอายุ 15
                  นาที
                </p>
                <Button
                  fullWidth
                  type="button"
                  variant="secondary"
                  onPress={requestReset}
                  isDisabled={forgotSending}
                >
                  {forgotSending ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
                </Button>
                {forgotNote && (
                  <p className="text-xs text-slate-500">{forgotNote}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Courtesy, not protection: the request is refused by the gate in proxy.ts
  // whatever the menu shows. This only spares people the walk to a locked
  // door — an item with no permission of its own is for everyone.
  const allowed = (item: { permission?: string | null; ownerOnly?: boolean }) =>
    isAllowed(item, { permissions, role: me?.role_key ?? null });
  const visibleItems = ALL_ITEMS.filter(allowed);

  const labelOf = (item: { label: string }) => item.label;
  const current = ALL_ITEMS.find((item) => isActive(item.href, pathname));
  const query = navQuery.trim().toLowerCase();
  const groups = query
    ? [
        {
          label: "ผลการค้นหา",
          items: visibleItems.filter((i) =>
            i.label.toLowerCase().includes(query),
          ),
        },
      ]
    : NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter(
        (g) => g.items.length > 0,
      );

  const contentWidth = FULL_WIDTH.includes(current?.href ?? "")
    ? ""
    : WIDE_TABLE.includes(current?.href ?? "")
      ? "mx-auto w-full max-w-[1400px]"
      : "mx-auto w-full max-w-[1100px]";

  return (
    // Screens inside the console read this rather than each asking
    // /api/admin/me again — the overview filters its shortcuts with it.
    <AdminAccessProvider value={{ permissions, role: me?.role_key ?? null }}>
      <AdminActionProvider>
        {/* The canvas the cards sit on. surface-soft at half opacity came out
          at #f9fcfb and surface-muted at #eef3f2 — both close enough to white
          that a card on them had no edge at all, and a console is mostly
          cards. This is a clear step down from white. */}
        <div className="admin-canvas flex min-h-screen flex-col bg-[#e4ecea] dark:bg-slate-950">
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
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <Link
              href="/admin"
              className="flex shrink-0 items-center gap-2 font-bold text-brand-ink"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-brand-gradient-soft text-brand-800">
                <LayoutDashboard size={15} />
              </span>
              <span className="hidden sm:inline">Smoothlife · หลังบ้าน</span>
            </Link>
            {current && (
              <p className="hidden min-w-0 items-center gap-1.5 text-sm text-slate-400 md:flex">
                <span aria-hidden>/</span>{" "}
                <span className="truncate font-semibold text-slate-600">
                  {labelOf(current)}
                </span>
              </p>
            )}
            <div className="ms-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPaletteTick((n) => n + 1)}
                className="hidden items-center gap-2 rounded-xl border border-surface-line px-2.5 py-1.5 text-xs text-slate-400 hover:text-brand-ink md:flex"
              >
                <Search size={13} /> ไปที่หน้า…
                <kbd className="rounded border border-surface-line px-1 py-0.5 text-[10px]">
                  ⌘K
                </kbd>
              </button>
              {me && (
                <p className="hidden text-xs font-semibold text-slate-500 md:block">
                  {me.display_name}
                </p>
              )}
              {/* Where a name would be. Shown at every width, unlike the name:
                  what this says matters more than who is signed in, because
                  everything saved from here is recorded as "ไม่ระบุ" and no
                  later audit can work out who did it. */}
              {sharedLogin && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"
                  title="เข้าระบบด้วยรหัสผ่านรวม ทุกอย่างที่แก้จากเครื่องนี้จะถูกบันทึกว่า “ไม่ระบุ” ไม่มีชื่อคนแก้ — ออกจากระบบแล้วเข้าใหม่ด้วยอีเมลของตัวเองเพื่อให้ชื่อติดไปกับงาน"
                >
                  <AlertTriangle size={12} aria-hidden="true" />
                  <span className="hidden sm:inline">เข้าด้วยรหัสผ่านรวม</span>
                  <span className="sm:hidden">รหัสรวม</span>
                </span>
              )}
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
          <CommandPalette
            key={paletteTick}
            items={visibleItems.map((i) => ({ ...i, group: groupOf(i.href) }))}
            openOnMount={paletteTick > 0}
          />

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside
              className={`shrink-0 border-surface-line bg-white lg:border-r lg:transition-[width] ${collapsed ? "lg:w-[68px]" : "lg:w-[228px]"}`}
            >
              {/* The menu keeps its place while a long page scrolls, and scrolls
                on its own if it ever outgrows the window. */}
              <div className="lg:sticky lg:top-12 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:p-3 lg:pt-4 md:lg:top-14 md:lg:max-h-[calc(100vh-3.5rem)]">
                {!collapsed && (
                  <div className="relative mb-3 hidden lg:block">
                    <AdminSearch
                      className="w-full"
                      value={navQuery}
                      onChange={setNavQuery}
                      label="ค้นหาเมนู"
                      placeholder="ค้นหาเมนู"
                    />
                  </div>
                )}

                {/* On a phone the menu is one scrollable row of the same links. */}
                <nav className="flex gap-1.5 overflow-x-auto border-b border-surface-line bg-white px-3 py-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-0 lg:p-0">
                  {groups.map((group, groupIndex) => (
                    /* A rule above each group, not just space: five headings in
                      the same grey at the same size read as one list with
                      words in it. It belongs on this container — as a
                      `first:` rule on the heading it never fired, because
                      every heading is the first child of its own group. */
                    <div
                      key={group.label}
                      className={clsx(
                        "contents lg:mb-3 lg:block",
                        groupIndex > 0 &&
                          group.label &&
                          !collapsed &&
                          "lg:mt-3 lg:border-t lg:border-surface-line lg:pt-3",
                      )}
                    >
                      {group.label && !collapsed && (
                        <p className="mb-1.5 hidden px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 lg:block">
                          {group.label}
                        </p>
                      )}
                      {group.label && collapsed && (
                        <div className="mx-3 mb-2 hidden border-t border-surface-line lg:block" />
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
                              title={collapsed ? labelOf(item) : undefined}
                              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                                collapsed ? "lg:justify-center lg:px-0" : ""
                              } ${active ? "bg-brand-gradient-soft text-brand-800" : "text-slate-600 hover:bg-surface-soft hover:text-brand-ink"}`}
                            >
                              <span className="relative shrink-0">
                                <Icon size={16} />
                                {/* Collapsed, the number has nowhere to sit, so
                                  it becomes a dot on the icon — still the
                                  answer to "is anyone waiting". */}
                                {item.href === "/admin/inbox" &&
                                  unread.messages > 0 &&
                                  collapsed && (
                                    <span
                                      className={`absolute -right-1 -top-1 hidden size-2 rounded-full lg:block ${
                                        unread.urgent > 0
                                          ? "bg-rose-500"
                                          : "bg-brand-action"
                                      }`}
                                    />
                                  )}
                              </span>
                              <span className={collapsed ? "lg:hidden" : ""}>
                                {labelOf(item)}
                              </span>
                              {item.href === "/admin/inbox" &&
                                unread.messages > 0 && (
                                  <span
                                    aria-label={`ยังไม่ได้อ่าน ${unread.messages} ข้อความ`}
                                    className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white ${
                                      unread.urgent > 0
                                        ? "bg-rose-500"
                                        : "bg-brand-action"
                                    } ${collapsed ? "lg:hidden" : ""}`}
                                  >
                                    {unread.messages > 99
                                      ? "99+"
                                      : unread.messages}
                                  </span>
                                )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {groups[0].items.length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-400">
                      ไม่พบเมนูที่ค้นหา
                    </p>
                  )}
                </nav>
              </div>
            </aside>

            {/* Dashboards (the inbox, the flash-sale console) use every pixel;
              the rest are lists and forms, which stop being readable past
              ~1400px. */}
            <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
              <div className={contentWidth}>
                {/* Where you are, and what this page is for — the page's own
                  title and content follow underneath. */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-5">
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    หลังบ้าน <span aria-hidden>/</span>{" "}
                    <span className="font-semibold text-slate-500">
                      {current?.label ?? "ภาพรวม"}
                    </span>
                  </p>
                  <AdminActionButton />
                </div>
                <div className="[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-brand-ink md:[&_h1]:text-2xl">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </div>
      </AdminActionProvider>
    </AdminAccessProvider>
  );
}

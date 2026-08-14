"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  ShoppingBag,
  User,
  Menu,
  X,
  Sparkles,
  LayoutGrid,
  Heart,
  BookOpen,
  ShieldCheck,
  HelpCircle,
  ChevronRight,
  Coins,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";
import { tierBadge, tierCard } from "@/lib/tier";
import LanguageSwitch from "@/components/LanguageSwitch";

const navLinks = [
  { href: "/shop", th: "ช้อปสินค้า", en: "Shop", icon: LayoutGrid },
  { href: "/concern", th: "เลือกตามปัญหาผิว", en: "Shop by Concern", icon: Heart },
  { href: "/ai-assistant", th: "ผู้ช่วย AI", en: "AI Assistant", icon: Sparkles },
  { href: "/knowledge", th: "ความรู้ความงาม", en: "Beauty Knowledge", icon: BookOpen },
  { href: "/about", th: "ทำไมต้อง Smooth Life", en: "Why Smooth Life", icon: ShieldCheck },
  { href: "/help", th: "ช่วยเหลือ", en: "Help", icon: HelpCircle },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hideHeader, setHideHeader] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const { user } = useAuth();
  const { count } = useCart();
  const { t } = useLang();
  const router = useRouter();

  // lock background scroll while the mobile drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // app-style collapsing header on mobile: hide on scroll down, reveal on scroll up
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setScrolled(y > 4);
      if (window.innerWidth >= 1024) {
        setHideHeader(false);
      } else {
        setHideHeader(y > lastScrollY.current && y > 80);
      }
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
    }
  }

  return (
    <>
    <header
      className={`sticky top-0 z-40 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)] transition-transform duration-300 lg:!translate-y-0 lg:border-b lg:border-slate-100 ${
        hideHeader && !open ? "-translate-y-full" : "translate-y-0"
      } ${scrolled ? "border-b border-slate-100" : "border-b border-transparent"}`}
    >
      <div className="bg-brand-gradient text-white text-center text-[11px] md:text-xs py-1.5 px-3">
        <span className="hidden sm:inline">
          ส่งฟรีทั่วไทย • ของแท้ 100% มีอย. • สมัครสมาชิกวันนี้รับ 100 คะแนนฟรี
        </span>
        <span className="sm:hidden">ส่งฟรีทั่วไทย • ของแท้ 100% • สมัครรับ 100 คะแนน</span>
      </div>
      <div className="container-page flex items-center gap-3 md:gap-6 py-2.5 lg:py-3">
        <button className="lg:hidden shrink-0" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={24} />
        </button>

        <Link href="/" className="shrink-0 font-extrabold text-xl md:text-2xl tracking-tight">
          <span className="brand-text-gradient">Smoothlife</span>
          <span className="text-brand-sky">.com</span>
        </Link>

        <form onSubmit={onSearch} className="hidden md:flex flex-1 max-w-xl relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="ค้นหาสินค้า, ยี่ห้อ, หรือปัญหาผิวที่กังวล..."
            className="w-full rounded-full border border-slate-200 bg-surface-soft py-2.5 pl-4 pr-11 text-sm outline-none focus:border-brand-teal transition-colors"
          />
          <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-white">
            <Search size={15} />
          </button>
        </form>

        <div className="ml-auto flex items-center gap-3 md:gap-5 shrink-0">
          <div className="hidden sm:block">
            <LanguageSwitch />
          </div>
          {user ? (
            <Link
              href="/account"
              className="hidden sm:flex items-center gap-2.5 rounded-full bg-gradient-to-b from-white to-slate-50 pl-1.5 pr-1.5 py-1.5 border border-slate-100 shadow-md hover:shadow-lg hover:-translate-y-px transition-all"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white text-xs font-bold overflow-hidden ring-2 ring-offset-2"
                style={{ ["--tw-ring-color" as string]: tierCard[user.tier].accent }}
              >
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="hidden lg:flex flex-col leading-tight">
                <span className="text-xs font-bold text-brand-ink max-w-[92px] truncate">{user.name.split(" ")[0]}</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Coins size={10} className="text-amber-500" /> {user.points} pts
                </span>
              </span>
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold text-white whitespace-nowrap shadow-sm"
                style={{ background: tierCard[user.tier].gradient }}
              >
                {(() => {
                  const TierIcon = tierBadge[user.tier].icon;
                  return <TierIcon size={11} />;
                })()}
                Lv.{tierBadge[user.tier].level}
              </span>
            </Link>
          ) : (
            <>
              <Link href="/ai-assistant" className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-brand-emerald">
                <Sparkles size={14} /> น้อง Smoothie
              </Link>
              <Link href="/account/login" className="hidden lg:flex items-center gap-1.5" aria-label="Account">
                <User size={22} />
                <span className="hidden lg:inline text-sm font-medium">เข้าสู่ระบบ</span>
              </Link>
            </>
          )}
          <Link href="/search" className="lg:hidden" aria-label="Search">
            <Search size={22} />
          </Link>
          <Link href="/cart" className="relative hidden lg:block" aria-label="Cart">
            <ShoppingBag size={22} />
            {count > 0 && (
              <span
                key={count}
                className="absolute -top-2 -right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-sky px-1 text-[10px] font-bold text-white animate-pop"
              >
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      <nav className="hidden lg:block border-t border-slate-100">
        <div className="container-page flex items-center gap-7 py-2.5 text-sm font-medium text-slate-600">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand-emerald transition-colors">
              {t(l.th, l.en)}
            </Link>
          ))}
        </div>
      </nav>
    </header>

      {open && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex max-h-[100dvh] w-80 max-w-[85vw] flex-col bg-white shadow-xl overflow-y-auto overscroll-contain rounded-br-2xl animate-fadeUp">
            <div className="bg-brand-gradient-soft px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-5">
              <div className="flex items-center justify-between mb-5">
                <span className="font-extrabold text-lg">
                  <span className="brand-text-gradient">Smoothlife</span>
                  <span className="text-brand-sky">.com</span>
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-white/70 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {user ? (
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-white font-bold overflow-hidden ring-2 ring-white">
                    {user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt={user.name} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      user.name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-brand-ink truncate">{user.name.split(" ")[0]}</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      {user.points} pts
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tierBadge[user.tier].className}`}
                      >
                        Lv.{tierBadge[user.tier].level}
                      </span>
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-slate-300 shrink-0" />
                </Link>
              ) : (
                <Link
                  href="/account/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm shadow-card"
                >
                  <User size={16} />
                  {t("เข้าสู่ระบบ / สมัครสมาชิก", "Sign in / Sign up")}
                </Link>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <LanguageSwitch compact />

              <form onSubmit={onSearch} className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหาสินค้า..."
                  className="w-full rounded-full border border-slate-200 bg-surface-soft py-2.5 pl-4 pr-10 text-sm outline-none focus:border-brand-teal transition-colors"
                />
                <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-white">
                  <Search size={13} />
                </button>
              </form>

              <div className="flex flex-col gap-0.5">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface-soft transition-colors"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald">
                      <l.icon size={15} />
                    </span>
                    {t(l.th, l.en)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

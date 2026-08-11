"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, ShoppingBag, User, Menu, X, Sparkles, Award } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";
import LanguageSwitch from "@/components/LanguageSwitch";

const navLinks = [
  { href: "/shop", th: "ช้อปสินค้า", en: "Shop" },
  { href: "/concern", th: "เลือกตามปัญหาผิว", en: "Shop by Concern" },
  { href: "/ai-assistant", th: "ผู้ช่วย AI", en: "AI Assistant" },
  { href: "/knowledge", th: "ความรู้ความงาม", en: "Beauty Knowledge" },
  { href: "/about", th: "ทำไมต้อง Smooth Life", en: "Why Smooth Life" },
  { href: "/help", th: "ช่วยเหลือ", en: "Help" },
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
              className="hidden sm:flex items-center gap-2 rounded-full bg-surface-muted pl-1.5 pr-3 py-1.5 text-xs font-semibold text-brand-dark hover:bg-surface-soft transition-colors"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-gradient text-white text-[11px] font-bold overflow-hidden">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={user.name} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="hidden lg:inline">{user.name.split(" ")[0]}</span>
              <span className="hidden lg:inline h-3 w-px bg-slate-300" />
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Award size={13} className="text-amber-500" /> {user.points} pts · Lv. {user.tier}
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
          <Link href="/cart" className="relative" aria-label="Cart">
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
          <div className="absolute left-0 top-0 max-h-[100dvh] w-80 max-w-[85vw] bg-white p-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl overflow-y-auto overscroll-contain rounded-br-2xl">
            <div className="flex items-center justify-between mb-6">
              <span className="font-extrabold text-lg">
                <span className="brand-text-gradient">Smoothlife</span>
                <span className="text-brand-sky">.com</span>
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <X size={22} />
              </button>
            </div>
            <div className="mb-4">
              <LanguageSwitch compact />
            </div>
            <form onSubmit={onSearch} className="relative mb-5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาสินค้า..."
                className="w-full rounded-full border border-slate-200 bg-surface-soft py-2.5 pl-4 pr-10 text-sm outline-none"
              />
              <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-white">
                <Search size={13} />
              </button>
            </form>
            <div className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface-soft"
                >
                  {t(l.th, l.en)}
                </Link>
              ))}
              <div className="my-2 h-px bg-slate-100" />
              <Link href={user ? "/account" : "/account/login"} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface-soft">
                {user ? t("บัญชีของฉัน", "My account") : t("เข้าสู่ระบบ / สมัครสมาชิก", "Sign in / Sign up")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

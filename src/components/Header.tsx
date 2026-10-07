"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ShoppingBag,
  ShoppingCart,
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
  Repeat,
  Tag,
  Percent,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart, useWishlist } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";
import { tierBadge, tierCard } from "@/lib/tier";
import { REWARDS_ACTIVITIES_ENABLED } from "@/lib/feature-flags";
import LanguageSwitch from "@/components/LanguageSwitch";
import NotificationBell from "@/components/NotificationBell";
import HeaderSearch from "@/components/HeaderSearch";
import { Avatar, Button } from "@/components/ui";
import BrandLogo from "@/components/BrandLogo";
import { formatTHB } from "@/lib/format";
import type { TickerProduct } from "@/lib/ticker-products";

import MegaMenu from "@/components/nav/MegaMenu";
import MobileShopMenu from "@/components/nav/MobileShopMenu";

// The bar under the search box, on a screen with room for it. Five shop
// links on the left — the first one opens the shop panel — and two support
// links pushed over to the right.
const deskNav = [
  { href: "/brands", th: "แบรนด์ทั้งหมด", en: "All brands", mega: true },
  { href: "/shop", th: "สินค้าแนะนำ", en: "Recommended" },
  { href: "/subscription", th: "เซ็ตสมาชิก", en: "Member sets" },
  { href: "/knowledge", th: "บทความ", en: "Articles" },
  { href: "/promotions", th: "โปรโมชั่น", en: "Promotions" },
];

const deskUtilityNav = [
  { href: "/help", th: "คำถามที่พบบ่อย", en: "FAQ" },
  { href: "/account/referral", th: "โปรแกรม Affiliate", en: "Affiliate program" },
];

// The drawer keeps its own, longer list. The desktop bar above is what the
// design specifies and it drops four destinations (ปัญหาผิว, ผู้ช่วย AI,
// เกี่ยวกับเรา, ช่วยเหลือ as a section) that have nowhere else to go on a
// phone — so the drawer is a superset rather than a copy of it.
const navLinks = [
  { href: "/shop", th: "ช้อปสินค้า", en: "Shop", icon: LayoutGrid },
  { href: "/brands", th: "แบรนด์ทั้งหมด", en: "All brands", icon: Tag },
  { href: "/promotions", th: "โปรโมชั่น", en: "Promotions", icon: Percent },
  { href: "/concern", th: "เลือกตามปัญหาผิว", en: "Shop by Concern", icon: Heart },
  { href: "/subscription", th: "เซ็ตสมาชิก", en: "Member sets", icon: Repeat },
  { href: "/ai-assistant", th: "ผู้ช่วย AI", en: "AI Assistant", icon: Sparkles },
  { href: "/knowledge", th: "ความรู้ความงาม", en: "Beauty Knowledge", icon: BookOpen },
  { href: "/account/referral", th: "โปรแกรม Affiliate", en: "Affiliate program", icon: Users },
  { href: "/about", th: "ทำไมต้อง Smooth Life", en: "Why Smooth Life", icon: ShieldCheck },
  { href: "/help", th: "ช่วยเหลือ", en: "Help", icon: HelpCircle },
];

export default function Header({ ticker = [] }: { ticker?: TickerProduct[] }) {
  const [open, setOpen] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const { user } = useAuth();
  const { count } = useCart();
  const { slugs: wishlistSlugs } = useWishlist();
  const { t } = useLang();

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

  return (
    <>
    <header
      className={`sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-[env(safe-area-inset-top)] transition-transform duration-300 lg:translate-y-0! lg:border-b lg:border-slate-200 ${
        hideHeader && !open ? "-translate-y-full" : "translate-y-0"
      } ${scrolled ? "border-b border-slate-100" : "border-b border-transparent"}`}
    >
      {/* The strip belongs to the top of the page, not to the app bar.
          The header already hides on the way down and comes back on the way
          up — but it was coming back with this attached, so a scroll-up gave
          back three stacked rows when what was wanted was the search box. It
          folds away as soon as the page moves and unfolds only back at the
          very top. Desktop keeps it throughout: there is room.

          It carries products now rather than three marketing claims on a
          loop. The claims are still made, with links behind them, in the
          trust strip on the home page; this band is on every page, so what
          goes in it may as well be the shop. */}
      {ticker.length > 0 && (
        <div
          className={`overflow-hidden bg-slate-100 transition-all duration-300 lg:max-h-16 lg:opacity-100 ${
            scrolled ? "max-h-0 opacity-0" : "max-h-16 opacity-100"
          }`}
        >
          {/* Paused under the pointer: every chip is a link, and a link that
              is still moving when it is clicked is a link that gets missed.
              The second copy of the list is what closes the loop — it is the
              same fourteen products, so it is hidden from assistive tech and
              taken out of the tab order rather than read out twice. */}
          <div
            className="flex w-max animate-marquee gap-2 py-1.5 hover:[animation-play-state:paused]"
            style={{ animationDuration: "70s" }}
          >
            {[...ticker, ...ticker].map((p, i) => {
              const copy = i >= ticker.length;
              return (
                <Link
                  key={`${p.slug}-${i}`}
                  href={`/product/${p.slug}`}
                  aria-hidden={copy || undefined}
                  tabIndex={copy ? -1 : undefined}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 ring-1 ring-slate-200/80 transition-colors hover:ring-brand-teal"
                >
                  {/* The packshots are products on white, so the thumbnail needs a
                      slot of its own or it dissolves into the card around it. */}
                  <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    <Image src={p.image} alt="" fill sizes="28px" className="object-cover" />
                  </span>
                  <span translate="no" className="max-w-[190px] truncate text-[11px] font-medium text-slate-600">
                    {p.name}
                  </span>
                  <span translate="no" className="text-[11px] font-bold tabular-nums text-brand-800">
                    {formatTHB(p.price)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {/* Wider than the 1280 the page body sits in: the design puts the
          logo and the cart near the edges of a 1512 screen, so the bar has
          its own bed rather than container-page's. */}
      <div className="mx-auto flex max-w-[1512px] items-center gap-3 px-4 py-2 md:gap-6 md:px-6 lg:py-2.5">
        <button className="lg:hidden shrink-0" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={24} />
        </button>

        <Link href="/" aria-label="Smoothlife.com หน้าแรก" className="shrink-0">
          <BrandLogo priority className="h-6 md:h-7 lg:h-10" />
        </Link>

        {/* A plain grey field with the magnifier inside it, per the design —
            the gradient pill that used to sit on the right read as the page's
            primary button when it is only a submit for something already
            typed. */}
        <div className="hidden md:flex flex-1 lg:max-w-[700px]">
          <HeaderSearch
            placeholder="ค้นหาสินค้าหรือแบรนด์…"
            inputClassName="h-11 w-full rounded-full border border-transparent bg-slate-100 pl-5 pr-12 text-sm text-brand-ink outline-hidden transition-colors placeholder:text-slate-500 focus:border-brand-teal focus:bg-white lg:h-12"
            buttonClassName="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-slate-700 transition-colors hover:text-brand-800"
            buttonSize={19}
          />
        </div>

        <div className="ml-auto flex items-center gap-3 md:gap-5 shrink-0">
          {/* Mobile keeps the outline-circle trigger so it sits quietly with
              the icons beside it; desktop gets the labelled one. Same menu
              behind both. */}
          <div className="lg:hidden shrink-0">
            <LanguageSwitch variant="icon" />
          </div>
          <div className="hidden lg:block">
            <LanguageSwitch variant="code" />
          </div>
          {user ? (
            <Link
              href="/account"
              className="hidden sm:flex items-center gap-2.5 rounded-full bg-linear-to-b from-white to-slate-50 pl-1.5 pr-1.5 py-1.5 border border-slate-100 shadow-md hover:shadow-lg transition"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white text-xs font-bold overflow-hidden ring-2 ring-offset-2"
                style={{ ["--tw-ring-color" as string]: tierCard[user.tier].accent }}
              >
                <Avatar src={user.avatar} name={user.name} className="h-9 w-9" />
              </span>
              <span className="hidden lg:flex flex-col leading-tight">
                <span className="text-xs font-bold text-brand-ink max-w-[92px] truncate">{user.name.split(" ")[0]}</span>
                {REWARDS_ACTIVITIES_ENABLED && <span className="text-[11px] text-slate-500">{user.points} pts</span>}
              </span>
              <span
                className="rounded-full px-2.5 py-1.5 text-[11px] font-bold text-white whitespace-nowrap shadow-xs"
                style={{ background: tierCard[user.tier].gradient }}
              >
                Lv.{tierBadge[user.tier].level}
              </span>
            </Link>
          ) : (
            <>
              <Link href="/ai-assistant" className="hidden sm:flex lg:hidden items-center gap-1.5 text-xs font-semibold text-brand-800">
                <Sparkles size={14} /> น้อง Smoothie
              </Link>
              <Link
                href="/account/login"
                className="hidden h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-brand-ink transition-colors hover:border-brand-teal lg:flex"
              >
                <User size={19} />
                เข้าสู่ระบบ/ลงทะเบียน
              </Link>
            </>
          )}
          <Link
            href="/account/wishlist"
            aria-label="รายการโปรด"
            className="relative lg:hidden text-slate-500"
          >
            <Heart size={22} />
            {wishlistSlugs.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-brand-sky px-1 text-[9px] font-bold text-white">
                {wishlistSlugs.length}
              </span>
            )}
          </Link>
          <div className="lg:hidden">
            <NotificationBell />
          </div>
          <div className="hidden lg:block">
            <NotificationBell />
          </div>
          <Link
            href="/cart"
            className="relative hidden h-11 w-11 place-items-center rounded-full bg-slate-100 text-brand-ink transition-colors hover:bg-brand-50 hover:text-brand-800 lg:grid"
            aria-label="ตะกร้าสินค้า"
          >
            <ShoppingCart size={21} />
            {count > 0 && (
              <span
                key={count}
                className="absolute -top-1 -right-1 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-brand-teal px-1 text-[10px] font-bold text-white animate-pop"
              >
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile-only inline search row — replaces the old icon-only "/search"
          link with a real search bar (same reusable HeaderSearch used on
          desktop). Location + wishlist + notifications all live in the logo
          row above instead of here. */}
      <div className="md:hidden mx-auto max-w-[1512px] px-4 pb-1.5">
        <div className="flex items-center gap-2">
          <HeaderSearch
            placeholder="ค้นหาสินค้า, ยี่ห้อ…"
            inputClassName="h-11 w-full rounded-[14px] border-0 bg-slate-100 pl-4 pr-11 text-[14px]! text-slate-900 outline-hidden placeholder:text-slate-500 focus:bg-slate-100/80 transition-colors"
            buttonClassName="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-brand-ink text-white"
          />
        </div>
      </div>

      {/* relative: the mega panel hangs off this bar, edge to edge. */}
      <nav className="relative hidden lg:block border-t border-slate-100">
        <div className="mx-auto flex max-w-[1512px] items-center gap-8 px-6 py-2.5 text-[15px] font-medium text-slate-700">
          {deskNav.map((l) =>
            l.mega ? (
              <MegaMenu key={l.href} label={t(l.th, l.en)} href={l.href} />
            ) : (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-brand-800">
                {t(l.th, l.en)}
              </Link>
            )
          )}
          {/* Support, not shopping — so it sits apart from the five above
              rather than sixth and seventh in the same run. */}
          <div className="ml-auto flex items-center gap-8">
            {deskUtilityNav.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-brand-800">
                {t(l.th, l.en)}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>

      {open && (
        <div className="fixed inset-0 z-100 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex max-h-dvh w-80 max-w-[85vw] flex-col bg-white shadow-xl overflow-y-auto overscroll-contain rounded-br-2xl animate-fadeUp">
            <div className="bg-brand-gradient-soft px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-5">
              <div className="flex items-center justify-between mb-5">
                <BrandLogo className="h-6" />
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
                    <Avatar src={user.avatar} name={user.name} className="h-11 w-11" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-brand-ink truncate">{user.name.split(" ")[0]}</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      {REWARDS_ACTIVITIES_ENABLED && <>{user.points} pts</>}
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
                <Button href="/account/login" size="lg" fullWidth onClick={() => setOpen(false)} className="shadow-card">
                  <User size={16} />
                  {t("เข้าสู่ระบบ / สมัครสมาชิก", "Sign in / Sign up")}
                </Button>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <LanguageSwitch compact />

              <MobileShopMenu onNavigate={() => setOpen(false)} />

              <div className="flex flex-col gap-0.5">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface-soft transition-colors"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
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

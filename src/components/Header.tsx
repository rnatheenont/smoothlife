"use client";

import Link from "next/link";
import { navIcon } from "@/components/icons/NavIcons";
import { HEADER_LINKS_DEFAULT } from "@/lib/pages/header-links-defaults";
import type { HeaderLinks } from "@/lib/pages/header-links";
import Image from "next/image";
import { shopifyImage } from "@/lib/shopify-image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ShoppingCart,
  User,
  Menu,
  X,
  Sparkles,
  LayoutGrid,
  Heart,
  Droplets,
  Search,
  BookOpen,
  ShieldCheck,
  HelpCircle,
  ChevronRight,
  Repeat,
  Tag,
  Percent,
  Users,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart, useWishlist } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";
import { useLoginModal } from "@/lib/login-modal-context";
import { tierBadge, tierCard } from "@/lib/tier";
import { REWARDS_ACTIVITIES_ENABLED } from "@/lib/feature-flags";
import LanguageSwitch from "@/components/LanguageSwitch";
import NotificationBell from "@/components/NotificationBell";
import HeaderSearch from "@/components/HeaderSearch";
import Countdown from "@/components/staff/Countdown";
import { useStaffAccess } from "@/lib/use-staff-access";
import { Avatar, Button } from "@/components/ui";
import BrandLogo from "@/components/BrandLogo";
import { formatTHB } from "@/lib/format";
import { SALE_HREF } from "@/lib/sale-destination";
import type { TickerProduct } from "@/lib/ticker-products";

import MegaMenu from "@/components/nav/MegaMenu";
import MobileShopMenu from "@/components/nav/MobileShopMenu";
import type { MenuCategory } from "@/data/nav-menu";

// The three navigation lists arrive as a prop, read on the server by the
// layout — the same arrangement as the shop menu below, and for the same
// reason: this is a client component. The built-in lists are the default, so
// a Header rendered with no links prop is the header the site has always had.
//
// The drawer stays a superset of the desktop bar rather than a copy: the bar
// is what the design specifies and it drops four destinations that have
// nowhere else to go on a phone.

export default function Header({
  ticker = [],
  menu = [],
  links = HEADER_LINKS_DEFAULT,
}: {
  ticker?: TickerProduct[];
  menu?: MenuCategory[];
  links?: HeaderLinks;
}) {
  const { desk: deskNav, deskUtility: deskUtilityNav, drawer: navLinks } = links;
  const [open, setOpen] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const { user } = useAuth();
  // The employee shop, only for accounts it is open to — not part of the
  // editable link lists, because who sees it is a per-account answer.
  const staff = useStaffAccess(Boolean(user));
  const { open: openLogin } = useLoginModal();
  const { slugs: wishlistSlugs } = useWishlist();
  const { count } = useCart();
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

  // Publishes how much room the bar is taking right now, so anything that
  // wants to stick directly beneath it can say top-(--app-header-h) instead
  // of hard-coding a number that is wrong on half the breakpoints.
  //
  // It has to be live rather than a constant: the bar is three different
  // heights (phone, phone with the promo strip unfolded, desktop with the nav
  // row), and on a phone it slides away entirely on the way down the page —
  // at which point the right offset is 0, not its height, or a sticky element
  // below it would float with a gap where the bar used to be.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => {
      const hidden = hideHeader && !open;
      // offsetHeight is the bar's own box and says nothing about the gap it
      // now floats in. Without the top offset a toolbar sticking to
      // top-(--app-header-h) parks that many pixels too high and the bar
      // sits on it.
      const gap = hidden ? 0 : el.getBoundingClientRect().top;
      document.documentElement.style.setProperty(
        "--app-header-h",
        `${hidden ? 0 : el.offsetHeight + Math.max(0, gap)}px`,
      );
    };
    publish();
    // Both, deliberately. The observer catches the bar changing height in
    // place — the promo strip folding away on the first scroll. It was not
    // firing for a viewport resize that changed the same height, so a phone
    // turned sideways kept the offset from the layout it had before.
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener("resize", publish);
    window.addEventListener("orientationchange", publish);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publish);
      window.removeEventListener("orientationchange", publish);
    };
    // scrolled is in here because it moves the bar without resizing it: the
    // observer watches the box, and detaching changes only where the box is.
  }, [hideHeader, open, scrolled]);

  return (
    <>
    <header
      ref={headerRef}
      // Flush to the top of the page while you are at the top of the page,
      // and a floating bar once the page has moved under it. Not decoration:
      // at the top the bar is part of the page and a full-bleed white band
      // with a hairline is the honest shape for that; once the page is
      // sliding beneath it the bar is a thing on top, and a card that says
      // so — inset, rounded, glass — reads as one layer rather than as the
      // page having a white stripe stuck to its forehead.
      //
      // No overflow-hidden, whatever the rounding wants: the mega menu's
      // panel lives inside this element and hangs below it, and clipping to
      // the header's own box would cut the menu off at its first row. The
      // promo strip has already folded to zero height by the time any of
      // this applies, so there is nothing left to spill out of the corners.
      className={`sticky z-40 pt-[env(safe-area-inset-top)] transition-[transform,top,margin,border-radius,background-color,box-shadow] duration-300 lg:translate-y-0! ${
        hideHeader && !open ? "-translate-y-full" : "translate-y-0"
      } ${
        scrolled
          ? "top-2 mx-2 rounded-2xl border border-slate-200/70 bg-white/75 shadow-[0_12px_32px_-14px_rgba(0,53,41,0.3)] backdrop-blur-lg sm:mx-4 lg:top-3 lg:mx-6"
          : "top-0 mx-0 rounded-none border-b border-transparent bg-white/95 backdrop-blur-sm lg:border-b lg:border-slate-200"
      }`}
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
          // The strip keeps its own grey, and on a desktop it stays open
          // while the bar is detached — so it has to take the bar's top
          // corners with it, or its square ones sit proud of them.
          className={`overflow-hidden bg-slate-100 transition-[max-height,opacity] duration-300 lg:max-h-16 lg:opacity-100 ${
            scrolled ? "max-h-0 opacity-0 rounded-t-2xl" : "max-h-16 opacity-100"
          }`}
        >
          <div className="flex items-center gap-2 py-1.5 pl-3 pr-0">
            {/* Sits outside the moving track, pinned to the left edge: the
                point of it is that it is always there to be pressed, and a
                shortcut that is only on screen for four seconds out of every
                seventy is not a shortcut. */}
            <Link
              href={SALE_HREF}
              className="flex h-8 shrink-0 items-center rounded-full bg-brand-gradient bg-[length:200%_100%] px-4 text-[13px] font-bold text-white shadow-xs transition-transform hover:animate-gradientPan hover:scale-105 active:scale-95"
            >
              Sale
            </Link>
            {/* Paused under the pointer: every chip is a link, and a link that
                is still moving when it is clicked is a link that gets missed.
                The second copy of the list is what closes the loop — it is the
                same fourteen products, so it is hidden from assistive tech and
                taken out of the tab order rather than read out twice. */}
            {/* Faded at the left edge so a chip leaving the track dissolves
                instead of being sliced mid-word against the Sale tag. */}
            <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_28px)]">
              <div
                className="flex w-max animate-marquee gap-2 hover:[animation-play-state:paused]"
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
                      {/* The packshots are products on white, so the thumbnail
                          needs a slot of its own or it dissolves into the card
                          around it. */}
                      <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        <Image src={shopifyImage(p.image, 96)} alt="" fill sizes="28px" className="object-cover" />
                      </span>
                      <span translate="no" className="max-w-[210px] truncate text-[13px] font-medium text-slate-600">
                        {p.name}
                      </span>
                      <span translate="no" className="text-[13px] font-bold tabular-nums text-brand-800">
                        {formatTHB(p.price)}
                      </span>
                      {p.compareAtPrice && (
                        <span
                          translate="no"
                          className="text-[11px] tabular-nums text-slate-500 line-through"
                        >
                          {formatTHB(p.compareAtPrice)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* container-page, the same bed the page body sits in. The bar used to
          have its own wider one (1512) so the logo and cart sat near the edges
          of a large screen — but that put the logo 92px to the left of the
          content underneath it at any width above 1280, which read as two
          layouts stacked rather than one. Using the class instead of repeating
          its numbers means the two cannot drift apart again. */}
      {/* A phone gets three columns — menu, logo, actions — because the
          design centres the wordmark and the two sides are not the same
          width. From md the row goes back to a flex line with the search
          field taking the middle. The search field is display:none below md,
          so it is not a column there. */}
      <div className="container-page grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 md:flex md:gap-6 lg:py-2.5">
        {/* -m-2.5 p-2.5: 44px of thumb around a 24px icon, without the
            padding pushing anything in the row along. */}
        <button className="-m-2.5 shrink-0 justify-self-start p-2.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={24} />
        </button>

        <Link href="/" aria-label="Smoothlife.com หน้าแรก" className="shrink-0 justify-self-center">
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

        <div className="flex shrink-0 items-center justify-self-end gap-3 md:ml-auto md:gap-5">
          {/* Desktop only. Below lg the drawer carries its own language
              switch, and a second one in the bar was a third icon competing
              with the two that actually move people around the shop. */}
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
              <button
                type="button"
                onClick={() => openLogin()}
                className="hidden h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-brand-ink transition-colors hover:border-brand-teal lg:flex"
              >
                <User size={19} />
                เข้าสู่ระบบ/ลงทะเบียน
              </button>
            </>
          )}
          {/* Phones get search here instead of a row of its own: a field
              that is always open costs 54px of every screen to save one tap,
              and the tap it saves is not the one most visits start with.
              From md up the field is in the logo row already, so this would
              only be a second way to reach the same thing. */}
          <Link
            href="/search"
            aria-label="ค้นหาสินค้า"
            className="-m-3 p-3 text-slate-500 md:hidden"
          >
            <Search size={22} />
          </Link>
          <div className="lg:hidden">
            <NotificationBell />
          </div>
          <div className="hidden lg:block">
            <NotificationBell />
          </div>
          <Link
            href="/cart"
            // Where a quick-add flies to on a desktop — see lib/fly-to-cart.
            data-cart-target="shop"
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

      {/* relative: the mega panel hangs off this bar, edge to edge. */}
      <nav className="relative hidden lg:block border-t border-slate-100">
        <div className="container-page flex items-center gap-8 py-2.5 text-sm font-medium text-slate-700">
          {deskNav.map((l) =>
            l.mega ? (
              <MegaMenu key={l.href} label={t(l.th, l.en)} href={l.href} menu={menu} />
            ) : (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-brand-800">
                {t(l.th, l.en)}
              </Link>
            )
          )}
          {staff.available && (
            // A button rather than another word in the row: this one is not
            // a place everyone can go, it is a thing a few people are
            // entitled to for a few more days. Reading like the links beside
            // it made it the easiest item in the bar to miss.
            <Link
              href="/staff"
              // No colour and no weight of its own: the row sets text-sm
              // font-medium text-slate-700 and every other item takes it. A
              // pill that also shouts in green reads as an advert rather
              // than as one of the places you can go — the border and the
              // day count are enough to set it apart.
              className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 transition-colors hover:border-brand-teal hover:bg-brand-100 hover:text-brand-800"
            >
              {t("ร้านพนักงาน", "Staff Store")}
              {staff.ends_at && (
                <Countdown
                  to={staff.ends_at}
                  daysOnly
                  className="whitespace-nowrap rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-brand-800"
                />
              )}
            </Link>
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
                <Button
                  size="lg"
                  fullWidth
                  onClick={() => {
                    // The drawer goes first: two layers over the page at
                    // once is one too many, and the dialog is the one being
                    // asked for.
                    setOpen(false);
                    openLogin();
                  }}
                  className="shadow-card"
                >
                  <User size={16} />
                  {t("เข้าสู่ระบบ / สมัครสมาชิก", "Sign in / Sign up")}
                </Button>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <LanguageSwitch compact />

              <MobileShopMenu menu={menu} onNavigate={() => setOpen(false)} />

              <div className="flex flex-col gap-0.5">
                {/* First, not tenth: it is the one entry here with a closing date. */}
                {staff.available && (
                  <Link
                    href="/staff"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface-soft transition-colors"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                      <ShoppingBag size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block">{t("ร้านพนักงาน", "Staff Store")}</span>
                      {staff.ends_at && (
                        <Countdown
                          to={staff.ends_at}
                          daysOnly
                          className="block whitespace-nowrap text-xs font-semibold text-brand-800"
                        />
                      )}
                    </span>
                  </Link>
                )}
                {navLinks.map((l) => {
                  const Icon = navIcon(l.icon);
                  return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface-soft transition-colors"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                      <Icon size={15} />
                    </span>
                    {t(l.th, l.en)}
                    {l.href === "/account/wishlist" && wishlistSlugs.length > 0 && (
                      <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-sky px-1.5 text-[11px] font-bold text-white">
                        {wishlistSlugs.length}
                      </span>
                    )}
                  </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

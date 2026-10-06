"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ScanFace, ShoppingBag, User } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useCart } from "@/lib/cart-context";

const tabs = [
  { href: "/", icon: Home, th: "หน้าแรก", en: "Home" },
  { href: "/shop", icon: LayoutGrid, th: "ช้อป", en: "Shop" },
  { href: "/advisor", icon: ScanFace, th: "ประเมินผิว", en: "Skin Check" },
  { href: "/cart", icon: ShoppingBag, th: "ตะกร้า", en: "Cart" },
  { href: "/account", icon: User, th: "บัญชี", en: "Account" },
];

/** Below this, the bar always shows: at the top of a page there is nothing to
 *  have scrolled away from, and a short page would otherwise be able to leave
 *  it hidden with no way to bring it back. */
const ALWAYS_SHOW_ABOVE = 80;
/** Ignore movement smaller than this. iOS rubber-banding and a trackpad's
 *  tail-off both produce a stream of 1-2px events in alternating directions,
 *  which without a floor makes the bar flicker. */
const DIRECTION_THRESHOLD = 8;

/**
 * Hidden while you read down the page, back as soon as you head up.
 *
 * Five tabs across the bottom of a phone is a lot of a small screen to spend
 * on navigation nobody is using while they scroll a product list.
 */
function useHideOnScrollDown(pathname: string): boolean {
  const [shown, setShown] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);

  // Re-armed on every navigation: a new page starts with the bar showing, and
  // the jump there is not a scroll the reader performed — left alone, the
  // remembered position would be the old page's and the first swipe on the
  // new one would be measured against it.
  //
  // Adjusted during render rather than in an effect, which is React's own
  // answer for "reset state when a prop changes" and saves the extra paint an
  // effect would cost here.
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setShown(true);
    // The remembered position is deliberately not touched here — a ref must
    // not be written during render. It is one gesture stale at worst, and the
    // first scroll event resets it.
  }

  useEffect(() => {
    lastY.current = window.scrollY;

    function evaluate() {
      ticking.current = false;
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < ALWAYS_SHOW_ABOVE) {
        lastY.current = y;
        setShown(true);
        return;
      }
      if (Math.abs(delta) < DIRECTION_THRESHOLD) return;
      lastY.current = y;
      // Down the page hides it, back up shows it.
      setShown(delta < 0);
    }

    function onScroll() {
      // One read per frame: scroll fires far more often than the screen draws,
      // and reading scrollY is a layout read.
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(evaluate);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return shown;
}

export default function MobileTabBar() {
  const pathname = usePathname() || "/";
  const { t } = useLang();
  const { count } = useCart();
  const shown = useHideOnScrollDown(pathname);

  function active(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav
      // inert while it is off-screen, so a keyboard cannot tab into a bar
      // nobody can see.
      inert={!shown}
      className={`lg:hidden fixed bottom-0 inset-x-0 z-90 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] motion-safe:transition-transform motion-safe:duration-200 ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const on = active(tab.href);
          const Icon = tab.icon;
          const isCart = tab.href === "/cart";
          const className = `relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition active:scale-90 active:opacity-60 w-full ${
            on ? "text-brand-800" : "text-slate-500"
          }`;
          const content = (
            <>
              <span
                key={on ? "active" : "inactive"}
                className={`relative inline-flex ${on ? "motion-safe:animate-tabPop" : ""}`}
              >
                <Icon size={21} strokeWidth={on ? 2.4 : 1.9} />
                {isCart && count > 0 && (
                  <span
                    key={count}
                    className="absolute -top-1.5 -right-2 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-brand-sky px-1 text-[9px] font-bold text-white animate-pop"
                  >
                    {count}
                  </span>
                )}
              </span>
              {t(tab.th, tab.en)}
              {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-gradient" />}
            </>
          );
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-current={on ? "page" : undefined} className={className}>
                {content}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

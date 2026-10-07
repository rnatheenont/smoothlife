"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ScanFace, ShoppingCart, User } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useCart } from "@/lib/cart-context";
import { useBottomNavShown, resetBottomNav } from "@/lib/bottom-nav-visibility";

const tabs = [
  { href: "/", icon: Home, th: "หน้าแรก", en: "Home" },
  { href: "/shop", icon: LayoutGrid, th: "ช้อป", en: "Shop" },
  { href: "/advisor", icon: ScanFace, th: "ประเมินผิว", en: "Skin Check" },
  { href: "/cart", icon: ShoppingCart, th: "ตะกร้า", en: "Cart" },
  { href: "/account", icon: User, th: "บัญชี", en: "Account" },
];

export default function MobileTabBar() {
  const pathname = usePathname() || "/";
  const { t } = useLang();
  const { count } = useCart();
  const shown = useBottomNavShown();

  // A new page starts with the bar showing — see resetBottomNav.
  useEffect(() => {
    resetBottomNav();
  }, [pathname]);

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

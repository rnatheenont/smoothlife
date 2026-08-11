"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Sparkles, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";

const tabs = [
  { href: "/", icon: Home, th: "หน้าแรก", en: "Home" },
  { href: "/shop", icon: LayoutGrid, th: "ช้อป", en: "Shop" },
  { href: "/advisor", icon: Sparkles, th: "AI", en: "AI" },
  { href: "/cart", icon: ShoppingBag, th: "ตะกร้า", en: "Cart" },
  { href: "/account", icon: User, th: "บัญชี", en: "Account" },
];

export default function MobileTabBar() {
  const pathname = usePathname() || "/";
  const { count } = useCart();
  const { t } = useLang();

  function active(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[90] border-t border-slate-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const on = active(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition active:scale-90 active:opacity-60 ${
                  on ? "text-brand-emerald" : "text-slate-400"
                }`}
              >
                <span className="relative">
                  <Icon size={21} strokeWidth={on ? 2.4 : 1.9} />
                  {tab.href === "/cart" && count > 0 && (
                    <span
                      key={count}
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-brand-gradient text-white text-[9px] font-bold animate-pop"
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                {t(tab.th, tab.en)}
                {on && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-gradient" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabIcon } from "@/components/icons/TabIcons";
import { MOBILE_TABS_DEFAULT, type MobileTab } from "@/lib/pages/mobile-tabs";
import { useLang } from "@/lib/lang-context";
import { useCart } from "@/lib/cart-context";

// The tabs arrive as a prop, read on the server by the layout — the same
// arrangement the footer's columns use, and for the same reason: this is a
// client component, so anything it imports ships to every browser.

export default function MobileTabBar({ tabs = MOBILE_TABS_DEFAULT }: { tabs?: MobileTab[] }) {
  const pathname = usePathname() || "/";
  const { t } = useLang();
  const { count } = useCart();

  function active(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    // Always on screen. It used to slide away as you read down the page,
    // which buys back 55px of a phone screen and costs the five things this
    // shop is navigated by — the cart and its count among them. Hiding the
    // way out of a page to make the page slightly taller is a bad trade on a
    // storefront, and it made the bar feel like it was fighting the scroll.
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-90 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      {/* The column count is an inline style, not a Tailwind class: the
          class would have to be built from a variable, and Tailwind only
          generates the classes it can see written out. A grid-cols-${n} that
          does not exist is a bar whose tabs all pile into one column. */}
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const on = active(tab.href);
          const Icon = tabIcon(tab.icon);
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
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                // The basket tab is where a quick-add flies to on a phone —
                // see lib/fly-to-cart.
                {...(isCart ? { "data-cart-target": "shop" } : {})}
                className={className}
              >
                {content}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

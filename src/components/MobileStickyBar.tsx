"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { useQuickChat } from "@/lib/quickchat-context";
import { useBottomNavShown } from "@/lib/bottom-nav-visibility";

// Shows a fixed bar above the mobile tab bar once `hideWhenVisible` scrolls
// out of view — used to keep a page's primary action (buy, checkout, pay)
// reachable without scrolling back up, the standard pattern in native
// shopping apps. Desktop is untouched (lg:hidden).
export default function MobileStickyBar({
  hideWhenVisible,
  children,
}: {
  hideWhenVisible: RefObject<HTMLElement>;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const { setStickyBarVisible } = useQuickChat();
  // The tab bar is what this sits on top of, and it slides away as you read
  // down the page. Without following it, this bar is left hovering with 55px
  // of the page showing underneath.
  const navShown = useBottomNavShown();

  useEffect(() => {
    const el = hideWhenVisible.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), {
      rootMargin: "0px 0px -10% 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hideWhenVisible]);

  // Let the chat launcher know to lift itself clear instead of being hidden
  // underneath this bar (see z-index note below).
  useEffect(() => {
    setStickyBarVisible(show);
    return () => setStickyBarVisible(false);
  }, [show, setStickyBarVisible]);

  if (!show) return null;

  return (
    <div
      // z-85 is above the AI Advisor FAB's z-80 — this bar covers it
      // rather than colliding with it wherever they'd otherwise overlap.
      // 55px matches MobileTabBar's actual rendered height exactly — it was
      // 60px before, leaving a 5px sliver where page content showed through
      // between this bar and the tab bar. 0 when that bar has slid away, in
      // the same 200ms so the two move as one piece.
      className={`lg:hidden fixed inset-x-0 z-85 flex items-center gap-3 border-t border-surface-line bg-white/95 backdrop-blur-md px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] animate-fadeUp motion-safe:transition-[bottom] motion-safe:duration-200 ${
        navShown ? "bottom-[55px]" : "bottom-0"
      }`}
    >
      {children}
    </div>
  );
}

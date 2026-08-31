"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { useQuickChat } from "@/lib/quickchat-context";

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
      // bottom-[55px] matches MobileTabBar's actual rendered height exactly
      // (55px) — it was 60px before, leaving a 5px sliver where page
      // content showed through between this bar and the tab bar.
      className="lg:hidden fixed bottom-[55px] inset-x-0 z-85 flex items-center gap-3 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] animate-fadeUp"
    >
      {children}
    </div>
  );
}

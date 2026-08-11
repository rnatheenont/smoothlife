"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";

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

  useEffect(() => {
    const el = hideWhenVisible.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), {
      rootMargin: "0px 0px -10% 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hideWhenVisible]);

  if (!show) return null;

  return (
    <div
      // z-[85] is above the AI Advisor FAB's z-[80] — this bar covers it
      // rather than colliding with it wherever they'd otherwise overlap.
      className="lg:hidden fixed bottom-[60px] inset-x-0 z-[85] flex items-center gap-3 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] animate-fadeUp"
    >
      {children}
    </div>
  );
}

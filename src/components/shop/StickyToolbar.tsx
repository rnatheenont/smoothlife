"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";

// The shop's filter bar, and the glass it only puts on once it is holding
// itself up.
//
// At the top of the page the bar is sitting in the page like anything else,
// and a tinted band there is a band across the middle of the banner with
// nothing behind it to be glass over. The moment it pins to the top edge it
// has the product grid running underneath it, and that is when it needs
// something between the chips and the photographs.
//
// Measured rather than observed: the bar sticks at --app-header-h, which the
// header rewrites as it hides and returns, so an IntersectionObserver would
// need rebuilding every time that number moved. One rect read per scroll
// event answers the same question exactly and never goes out of date.

export default function StickyToolbar({ children }: { children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const check = () => {
      const el = bar.current;
      if (!el) return;
      const offset =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--app-header-h"),
        ) || 0;
      // Half a pixel of slack: a sticky element parks exactly on its offset,
      // and sub-pixel layout can leave it a hair short of it.
      setStuck(el.getBoundingClientRect().top <= offset + 0.5);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <div
      ref={bar}
      className={clsx(
        "bleed-page sticky top-(--app-header-h) z-30 mb-4 py-2.5 transition-colors duration-200",
        stuck && "glass-bar",
      )}
    >
      {children}
    </div>
  );
}

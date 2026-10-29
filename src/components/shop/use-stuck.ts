"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Whether a sticky element is currently holding itself up.
 *
 * Measured rather than observed: these bars stick at --app-header-h, which
 * the header rewrites as it hides and returns, so an IntersectionObserver
 * would need rebuilding every time that number moved. One rect read per
 * scroll event answers the same question exactly and never goes out of date.
 *
 * @param gap extra distance below the header that the element parks at.
 */
export function useStuck(gap = 0): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const check = () => {
      const el = ref.current;
      if (!el) return;
      const header =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--app-header-h"),
        ) || 0;
      // Half a pixel of slack: a sticky element parks exactly on its offset,
      // and sub-pixel layout can leave it a hair short of it.
      setStuck(el.getBoundingClientRect().top <= header + gap + 0.5);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [gap]);

  return [ref, stuck];
}

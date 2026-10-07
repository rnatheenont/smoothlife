"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// A horizontal rail whose cut-off card fades out instead of being sliced.
//
// The slice is what says "there is more this way", but a hard vertical edge
// through a product photo reads as a rendering fault rather than as a hint.
// A gradient mask says the same thing and looks deliberate.
//
// It has to follow the scroll, which is why this is a hook and not a class:
// a fade that is always on the right edge is still fading once the rail has
// been scrolled to the end, where there is nothing left to hint at and the
// last card just looks broken instead.

/** How wide the fade is, in px. Narrow enough to read as an edge treatment
 *  rather than as a shadow across the card. */
const FADE = 56;
/** Scroll positions this close to an end count as being at it. */
const EPSILON = 4;

export function useRailFade() {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { start: el.scrollLeft > EPSILON, end: el.scrollLeft < max - EPSILON };
    setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    // The observer fires once when it starts watching, which is also the
    // first measurement — so nothing has to call sync() from the effect body
    // and set state during the render that scheduled it.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  const left = edges.start ? FADE : 0;
  const right = edges.end ? FADE : 0;
  const image = `linear-gradient(to right, transparent 0, #000 ${left}px, #000 calc(100% - ${right}px), transparent 100%)`;
  const style: CSSProperties = { maskImage: image, WebkitMaskImage: image };

  return { ref, style };
}

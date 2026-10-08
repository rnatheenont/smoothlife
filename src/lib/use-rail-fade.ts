"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

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

/** Where the fade starts applying. Below this the rail is a thumb-driven
 *  shelf two cards wide, and fading a third of the card you are dragging
 *  towards reads as the card being broken rather than as a hint. The flash
 *  sale band, which has no fade at any width, is what the phone shelves are
 *  matched to here. */
const FADE_FROM = "(min-width: 768px)";

/** Pass a ref when the rail already has one of its own — for arrows, a
 *  progress bar, anything that needs to scroll it; otherwise take the one
 *  returned. */
export function useRailFade<T extends HTMLElement = HTMLUListElement>(
  external?: RefObject<T | null>
) {
  const own = useRef<T>(null);
  const ref = external ?? own;
  const [edges, setEdges] = useState({ start: false, end: false });
  // Server-rendered as false and settled on mount: a mask that appears a
  // frame late costs nothing, where one that disappears would flash.
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(FADE_FROM);
    const sync = () => setFaded(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { start: el.scrollLeft > EPSILON, end: el.scrollLeft < max - EPSILON };
    setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [ref, sync]);

  // Measured again after every render, on the next frame.
  //
  // A ResizeObserver on the rail is not enough on its own: what decides
  // whether there is anything to fade towards is scrollWidth, and that
  // changes when the cards inside change — picking another brand, another
  // concern, another tab — while the rail's own box stays exactly the size
  // it was. Without this the fade stayed off on a shelf that was plainly
  // overflowing.
  //
  // Cheap to do unconditionally: one frame, and sync only sets state when
  // the answer actually changed, so it settles immediately.
  useEffect(() => {
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  });

  const left = edges.start ? FADE : 0;
  const right = edges.end ? FADE : 0;
  const image = `linear-gradient(to right, transparent 0, #000 ${left}px, #000 calc(100% - ${right}px), transparent 100%)`;
  const style: CSSProperties = faded ? { maskImage: image, WebkitMaskImage: image } : {};

  return { ref, style };
}

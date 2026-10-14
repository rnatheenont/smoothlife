"use client";

import { useEffect, useState, type RefObject } from "react";

// Whether an element is on screen.
//
// Carousels and galleries on this site animate themselves: a stack that
// turns every few seconds, a rail that drifts sideways. Off screen that work
// is invisible and still costs a timer, a layout and a paint on a phone that
// is doing something else — on the home page, several at once. This is the
// switch they all read.
//
// Starts false and turns true on the first observation, so nothing animates
// before the browser has told us where it is.

export function useInView(ref: RefObject<Element | null>, rootMargin = "200px"): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No observer (very old browser): treat it as on screen, which is how it
    // behaved before this existed.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return inView;
}

/**
 * Whether this tab is the one being looked at.
 *
 * A carousel in a background tab is the same waste as one off screen, and
 * the browser does not always throttle an interval enough to notice.
 */
export function useTabVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}

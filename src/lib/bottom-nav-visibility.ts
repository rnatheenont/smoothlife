"use client";

import { useSyncExternalStore } from "react";

// Whether the mobile tab bar is currently on screen.
//
// Two things sit on top of it — the sticky buy bar and, on a product page,
// whatever else is pinned above it — and they are positioned by its height.
// When it slides away they have to come down with it, or they are left
// hovering with a strip of page showing underneath.
//
// One listener for every subscriber rather than a hook each: two components
// each tracking the scroll position separately can disagree for a frame, and
// a gap opening and closing between two stacked bars is exactly the kind of
// disagreement you see.

/** Below this, the bar always shows: at the top of a page there is nothing to
 *  have scrolled away from, and a short page would otherwise be able to leave
 *  it hidden with no way to bring it back. */
const ALWAYS_SHOW_ABOVE = 80;
/** Ignore movement smaller than this. iOS rubber-banding and a trackpad's
 *  tail-off both produce a stream of 1-2px events in alternating directions,
 *  which without a floor makes the bar flicker. */
const DIRECTION_THRESHOLD = 8;

let shown = true;
let lastY = 0;
let ticking = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === shown) return;
  shown = next;
  for (const l of listeners) l();
}

function evaluate() {
  ticking = false;
  const y = window.scrollY;
  const delta = y - lastY;
  if (y < ALWAYS_SHOW_ABOVE) {
    lastY = y;
    set(true);
    return;
  }
  if (Math.abs(delta) < DIRECTION_THRESHOLD) return;
  lastY = y;
  // Down the page hides it, back up shows it.
  set(delta < 0);
}

function onScroll() {
  // One read per frame: scroll fires far more often than the screen draws,
  // and reading scrollY is a layout read.
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(evaluate);
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    lastY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("scroll", onScroll);
  };
}

/** A new page starts with the bar showing: the jump to the top of it is not a
 *  scroll the reader performed. */
export function resetBottomNav() {
  lastY = typeof window === "undefined" ? 0 : window.scrollY;
  set(true);
}

export function useBottomNavShown(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => shown,
    // Server render: nothing has scrolled, so it is on screen.
    () => true,
  );
}

"use client";

import { useEffect, useState } from "react";

// One clock for the whole page.
//
// Two countdowns can be on screen at once — the flash-sale band and the
// shelf under it — and each used to keep its own setInterval. Two timers
// that fire a few milliseconds apart also mean two renders a second instead
// of one, and on a phone that is two wake-ups for the same second.
//
// It stops in a background tab: a countdown nobody is looking at does not
// need to keep count, and the next tick after the tab comes back reads the
// clock afresh, so it is correct rather than merely resumed.

type Listener = () => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | undefined;

function fire() {
  for (const l of listeners) l();
}

function start() {
  if (timer !== undefined || typeof document === "undefined" || document.hidden) return;
  timer = setInterval(fire, 1000);
}

function stop() {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
}

function onVisibility() {
  if (document.hidden) stop();
  else {
    // Catch up first: a tab that was away for a minute should not show the
    // time it left at for another second.
    fire();
    start();
  }
}

/**
 * A counter that goes up once a second, for as long as the component is
 * mounted and the tab is in front.
 */
export function useSecond(): number {
  const [n, setN] = useState(0);

  useEffect(() => {
    const listener = () => setN((v) => v + 1);
    listeners.add(listener);
    if (listeners.size === 1) document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        document.removeEventListener("visibilitychange", onVisibility);
        stop();
      }
    };
  }, []);

  return n;
}

"use client";

import { useEffect, useState } from "react";

export type CountdownParts = {
  /** Whole days left. Zero for anything under 24 hours. */
  days: number;
  /** Hours within the day — 0–23, not the running total. */
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

// Days are their own number rather than more hours.
//
// They were not, and a promo ending on Saturday drew "130 : 08 : 44" in three
// boxes a shopper reads as hours, minutes, seconds — so the deal looked like
// it had 130 hours in its first box and no explanation for it. Five days is
// a thing people understand; 130 hours is arithmetic homework.
function partsFor(targetMs: number): CountdownParts {
  const diff = targetMs - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

// Live 1s-tick countdown to a target Date/ISO string — used by Deal of the
// day's real countdown. Clears its interval on unmount or once expired.
export function useCountdown(target: string | Date | null): CountdownParts {
  const targetMs = target ? new Date(target).getTime() : null;
  const [parts, setParts] = useState<CountdownParts>(() =>
    targetMs ? partsFor(targetMs) : { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true },
  );

  useEffect(() => {
    if (!targetMs) return;
    setParts(partsFor(targetMs));
    const id = setInterval(() => {
      const next = partsFor(targetMs);
      setParts(next);
      if (next.expired) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return parts;
}

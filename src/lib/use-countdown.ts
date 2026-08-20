"use client";

import { useEffect, useState } from "react";

export type CountdownParts = { hours: number; minutes: number; seconds: number; expired: boolean };

function partsFor(targetMs: number): CountdownParts {
  const diff = targetMs - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true };
  const totalSeconds = Math.floor(diff / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

// Live 1s-tick countdown to a target Date/ISO string — used by Deal of the
// day's real countdown. Clears its interval on unmount or once expired.
export function useCountdown(target: string | Date | null): CountdownParts {
  const targetMs = target ? new Date(target).getTime() : null;
  const [parts, setParts] = useState<CountdownParts>(() => (targetMs ? partsFor(targetMs) : { hours: 0, minutes: 0, seconds: 0, expired: true }));

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

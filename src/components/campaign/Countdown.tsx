"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n/messages";

// The clock on a campaign page.
//
// Two things make this harder than it looks.
//
// The first is hydration. The server renders at one instant and the browser
// at another, so rendering a live figure on the server guarantees a mismatch
// — and React's answer to a mismatch is to throw the tree away and redraw it,
// which is a visible flash on the largest element of the page. So the server
// renders placeholders and the real numbers appear on mount. That one frame
// of dashes is the honest cost of not lying about what time it is.
//
// The second is what happens at zero. The phase is decided on the server
// (see app/sale/[slug]), which means the page in front of the visitor is
// still the teaser a second after the sale started. router.refresh() asks
// the server to decide again, so the page turns over on its own rather than
// waiting for someone to reload — the plan asks for exactly this.
//
// Screen readers get one sentence per minute instead of a number per second:
// a timer that updates an aria-live region every second is unusable, and the
// digits themselves are aria-hidden for that reason.

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function partsOf(msLeft: number): Parts {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

type Words = Messages["countdown"];

function spoken(parts: Parts, w: Words): string {
  if (parts.days > 0) return w.spokenDays(parts.days, parts.hours);
  if (parts.hours > 0) return w.spokenHours(parts.hours, parts.minutes);
  if (parts.minutes > 0) return w.spokenMinutes(parts.minutes);
  return w.spokenSoon;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function Countdown({
  to,
  label,
  words,
  size = "md",
  onZeroRefresh = true,
}: {
  /** ISO instant. An unreadable one draws nothing rather than NaN. */
  to: string;
  label?: string;
  /**
   * The clock's own words, in the language the page is being drawn in.
   *
   * Handed down rather than looked up: this is a client component, and the
   * only way it could look them up itself is to carry both dictionaries into
   * the browser. The server component that draws it already knows the
   * locale (ctx.locale), so it costs it nothing to pass four words along.
   */
  words: Words;
  size?: "sm" | "md" | "lg";
  /** False for a countdown to something that is not a phase change — there
   *  is nothing for the server to decide again, so asking it is waste. */
  onZeroRefresh?: boolean;
}) {
  const target = Date.parse(to);
  const router = useRouter();
  const [parts, setParts] = useState<Parts | null>(null);
  const refreshed = useRef(false);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    const tick = () => {
      const left = target - Date.now();
      setParts(partsOf(left));
      if (left <= 0 && onZeroRefresh && !refreshed.current) {
        // Once. A countdown that has passed would otherwise ask the server to
        // re-render every second for as long as the tab is open.
        refreshed.current = true;
        router.refresh();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, onZeroRefresh, router]);

  if (!Number.isFinite(target)) return null;

  const box =
    size === "lg"
      ? // Measured at 375px: four 64px cells plus the label wrap onto a
        // second line, and a clock in two rows reads as a layout fault
        // rather than as a clock. The large size starts at md.
        "min-w-[48px] px-2 py-1.5 text-xl md:min-w-[76px] md:px-3 md:py-2 md:text-3xl"
      : size === "sm"
        ? "min-w-[40px] px-1.5 py-1 text-base"
        : "min-w-[52px] px-2 py-1.5 text-xl";

  const cells: [string, number | null][] = [
    [words.day, parts?.days ?? null],
    [words.hour, parts?.hours ?? null],
    [words.minute, parts?.minutes ?? null],
    [words.second, parts?.seconds ?? null],
  ];

  return (
    <div
      role="timer"
      // Updated on mount and then once a minute's worth of ticks, not every
      // second — see the note above.
      aria-label={parts ? `${label ?? words.label} ${spoken(parts, words)}` : label}
      className="flex flex-wrap items-end gap-1.5"
    >
      {label && <span className="mr-1 self-center text-[13px] font-medium opacity-90">{label}</span>}
      {cells.map(([unit, value]) => (
        <span key={unit} aria-hidden="true" className="flex flex-col items-center">
          <span
            className={`${box} rounded-lg text-center font-bold tabular-nums`}
            style={{ backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" }}
          >
            {value === null ? "––" : pad(value)}
          </span>
          <span className="mt-0.5 text-[11px] opacity-70">{unit}</span>
        </span>
      ))}
    </div>
  );
}

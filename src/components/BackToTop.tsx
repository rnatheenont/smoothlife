"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowUp } from "lucide-react";
import { useQuickChat } from "@/lib/quickchat-context";

// A way back to the top of a long page.
//
// Stacked directly above the chat launcher in the right-hand corner, and
// centred on it, so the two read as one column of round buttons rather than
// two things that happen to be nearby. That means it carries the launcher's
// own geometry as well as the bars underneath it — the numbers below are the
// ones in QuickChat, and they move together.

/** Roughly a screen and a half down: far enough that scrolling back by hand
 *  is a real chore, and not so soon that it appears while someone is still
 *  reading the first screen. */
const SHOW_AFTER = 900;

/** MobileTabBar's measured height, and MobileStickyBar's. Kept in step with
 *  the same numbers in QuickChat. */
const TAB_BAR_H = 55;
const BUY_BAR_H = 65;
/** QuickChat's own gap above the tab bar; sitting on the buy bar it goes
 *  flush, because that bar carries its own bottom padding. */
const GAP_ABOVE_TAB_BAR = 5;
/** The launcher this sits on top of: h-16 on mobile. */
const LAUNCHER_H = 64;
/** Between the two buttons. Enough to read as two, tight enough to read as
 *  one column. */
const GAP = 8;

export default function BackToTop() {
  const [shown, setShown] = useState(false);
  const { stickyBarVisible } = useQuickChat();

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      // One read per frame: scroll fires far more often than the screen
      // draws, and reading scrollY is a layout read.
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setShown(window.scrollY > SHOW_AFTER);
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const launcherBottom =
    TAB_BAR_H + (stickyBarVisible ? BUY_BAR_H : 0) + (stickyBarVisible ? 0 : GAP_ABOVE_TAB_BAR);
  const bottom = launcherBottom + LAUNCHER_H + GAP;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="กลับขึ้นด้านบน"
      // Hidden from the keyboard while it is faded out, so nobody can tab to
      // a button that is not on screen.
      inert={!shown}
      // Through a variable rather than straight onto `bottom`, so the
      // lg: offset below can still win on desktop — an inline bottom would
      // beat any class, and up there the launcher is bottom-3 and h-24 with
      // no tab bar under it: 12 + 96 + 8.
      //
      // The right offsets centre this 44px button on the launcher: 16 + 32 -
      // 22 on mobile (right-4, w-16), 20 + 48 - 22 on desktop (lg:right-5,
      // lg:w-24). z-70 keeps it under the launcher rather than over it — the
      // launcher can be dragged up here, and the thing being dragged should
      // be the thing on top.
      style={{ "--btt-bottom": `calc(${bottom}px + env(safe-area-inset-bottom))` } as CSSProperties}
      className={`fixed bottom-[var(--btt-bottom)] right-[26px] z-70 grid size-11 place-items-center rounded-full border border-slate-200 bg-white/90 text-brand-800 shadow-card backdrop-blur-md transition duration-200 active:scale-90 lg:bottom-[116px] lg:right-[46px] ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp size={19} strokeWidth={2.2} aria-hidden />
    </button>
  );
}

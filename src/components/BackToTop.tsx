"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowUp } from "lucide-react";
import { useQuickChat } from "@/lib/quickchat-context";

// A way back to the top of a long page.
//
// On the left. The right-hand corner belongs to the chat launcher, and it
// is not just the launcher that is there: the mascot's speech bubble rises
// out of its top, and the whole thing can be dragged anywhere on screen. A
// second round button in that corner either sits under the bubble or walks
// away from the launcher the moment someone moves it. Its own corner, with
// nothing in it, is the one place neither can happen.
//
// It still stacks on the same bars the launcher does, so the two sit level
// at opposite ends of the screen.

/** Roughly a screen and a half down: far enough that scrolling back by hand
 *  is a real chore, and not so soon that it appears while someone is still
 *  reading the first screen. */
const SHOW_AFTER = 900;

/** MobileTabBar's measured height, and MobileStickyBar's. Kept in step with
 *  the same numbers in QuickChat. */
const TAB_BAR_H = 55;
const BUY_BAR_H = 65;
const GAP = 12;

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

  const bottom = TAB_BAR_H + (stickyBarVisible ? BUY_BAR_H : 0) + GAP;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="กลับขึ้นด้านบน"
      // Hidden from the keyboard while it is faded out, so nobody can tab to
      // a button that is not on screen.
      inert={!shown}
      // Through a variable rather than straight onto `bottom`, so the
      // lg:bottom-3 below can still win on desktop — an inline bottom would
      // beat any class, and there is no tab bar up there to clear.
      style={{ "--btt-bottom": `calc(${bottom}px + env(safe-area-inset-bottom))` } as CSSProperties}
      className={`fixed bottom-[var(--btt-bottom)] left-4 z-80 grid size-11 place-items-center rounded-full border border-slate-200 bg-white/90 text-brand-800 shadow-card backdrop-blur-md transition duration-200 active:scale-90 lg:bottom-3 lg:left-5 ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp size={19} strokeWidth={2.2} aria-hidden />
    </button>
  );
}

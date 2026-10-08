"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// A way back to the top of a long page.
//
// Rendered inside QuickChat's own container rather than pinned to a corner of
// its own. The chat launcher can be dragged anywhere on screen, so a second
// button at a fixed corner either ends up far away from it or lands on top of
// it; parented to it, this rides along with the drag, the snap to an edge,
// and the way the launcher lifts over the tab bar and the buy bar — none of
// which has to be repeated here.
//
// Beside the launcher, not above it: above is where the mascot's speech
// bubble goes, and that bubble was landing on this button. Sharing a bottom
// edge with the launcher also makes the two read as a pair standing on the
// same line.

/** Roughly a screen and a half down: far enough that scrolling back by hand
 *  is a real chore, and not so soon that it appears while someone is still
 *  reading the first screen. */
const SHOW_AFTER = 900;

export default function BackToTop({ side = "right" }: { side?: "left" | "right" }) {
  const [shown, setShown] = useState(false);

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

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="กลับขึ้นด้านบน"
      // Hidden from the keyboard while it is faded out, so nobody can tab to
      // a button that is not on screen.
      inert={!shown}
      // Outside the container's own box (right-full / left-full), so the
      // launcher never shifts sideways when this appears — on whichever side
      // keeps it on screen once the launcher has been snapped to an edge,
      // which is the same flip the speech bubble makes.
      className={`absolute bottom-0 grid size-11 place-items-center rounded-full border border-slate-200 bg-white/90 text-brand-800 shadow-card backdrop-blur-md transition duration-200 active:scale-90 ${
        side === "left" ? "left-full ml-2" : "right-full mr-2"
      } ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <ArrowUp size={19} strokeWidth={2.2} aria-hidden />
    </button>
  );
}

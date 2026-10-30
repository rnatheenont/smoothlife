"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { useStuck } from "./use-stuck";

// The shop's filter bar, and the glass it only puts on once it is holding
// itself up.
//
// The room under it is small on purpose: the bar's own padding and its
// margin were stacking into a 26px band of nothing between the filters and
// the first row of cards, which read as a missing element rather than as
// space.
//
// At the top of the page the bar is sitting in the page like anything else,
// and a tinted band there is a band across the middle of the banner with
// nothing behind it to be glass over. The moment it pins to the top edge it
// has the product grid running underneath it, and that is when it needs
// something between the chips and the photographs.

export default function StickyToolbar({ children }: { children: ReactNode }) {
  const [bar, stuck] = useStuck();

  return (
    <div
      ref={bar}
      className={clsx(
        "bleed-page sticky top-(--app-header-h) z-30 mb-1.5 py-2",
        "transition-[background-color,max-width,border-radius,box-shadow,padding] duration-200",
        // On a desktop this is the left rail, not a bar across the top: it
        // keeps the sticky so the filters travel with a long grid, and drops
        // everything that was about being a full-width band — the bleed, the
        // cap, the centring, and the glass it only ever needed because the
        // grid ran underneath it. The two bangs are for bleed-page, which
        // sets margin-inline and padding-inline itself — without them the
        // rail kept a 50px gutter on each side and the pills inside it came
        // out content-width.
        "lg:mx-0! lg:max-w-none lg:rounded-none lg:bg-transparent lg:px-0! lg:shadow-none lg:backdrop-blur-none",
        stuck
          // Pinned, it is a card over the grid like the header above it, so
          // it takes the header's shape: the same 1024px, centred, with the
          // same corners. Running the full width while the bar above it had
          // pulled its ends in made the two read as unrelated layers.
          //
          // px-4 replaces what bleed-page's padding was doing once the box
          // stops being full-bleed, and the lg: prefixes keep the phone as it
          // was — there the header insets by a margin rather than capping its
          // width, and so does this.
          //
          // mx-auto! because bleed-page sets margin-inline itself, to a
          // negative gutter, and plain mx-auto lost to it: the bar came out
          // the right width and still hard against the left edge.
          ? "glass-bar lg:mx-auto! lg:max-w-5xl lg:rounded-2xl lg:px-4"
          : "",
      )}
    >
      {children}
    </div>
  );
}

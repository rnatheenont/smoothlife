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
// space. Trimmed too far, though — at 8px of padding the chips sat hard
// against the glass band's own top and bottom edges once the bar pinned,
// which reads as a crop rather than as a bar. 12px inside, 8px under: 20px
// to the cards, where 26 was too much and 14 too little.
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
        "bleed-page sticky top-(--app-header-h) z-30 mb-2 py-3",
        "transition-[background-color,max-width,border-radius,box-shadow,padding] duration-200",
        stuck
          // Pinned, it is a card over the grid like the header above it, so
          // it takes the header's shape — which is the page container, and
          // is what bleed-page already gives this box. So the pinned state
          // adds glass and corners and nothing else: no cap, no margin, no
          // padding of its own.
          //
          // It used to cap at max-w-5xl and re-pad with px-4, from when the
          // header was 1024 wide and this had to match it. Against a header
          // that is now the container, that cap left this bar 376px narrower
          // than the one directly above it, and the filters ran out of room
          // and wrapped the sort menu onto a second line. Keeping bleed-page's
          // own gutter is also what lines the first chip up with the burger
          // above it and the first product card below.
          ? "glass-bar lg:rounded-2xl"
          : "",
      )}
    >
      {children}
    </div>
  );
}

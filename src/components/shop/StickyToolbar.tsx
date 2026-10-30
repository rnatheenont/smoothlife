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
        "bleed-page sticky top-(--app-header-h) z-30 mb-1.5 py-2 transition-colors duration-200",
        stuck && "glass-bar",
      )}
    >
      {children}
    </div>
  );
}

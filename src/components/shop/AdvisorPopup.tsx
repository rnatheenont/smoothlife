"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";

// The way in to an advisor, as something that comes to you.
//
// It was a black slab the width of the page, sitting between the banner and
// the filters. It read as the most important thing on a shop page — louder
// than the products — and everyone scrolling to the grid had to go past it
// every time, whether or not they had already said no.
//
// A popup instead: it arrives a beat after the page settles, sits in the
// corner, and goes away when dismissed and stays away. The delay is not
// decoration — arriving with the page makes it part of the page, and the
// point is that it is not.
//
// Bottom-left on a desktop because the chat button is bottom-right, and the
// two of them in one corner is two mascots shouting. On a phone there is no
// spare corner, so it is a sheet along the bottom, above the tab bar.

const DELAY_MS = 1400;

/** Remembered per category: saying no to the supplement quiz is not saying no
 *  to the oral-care one. Wrapped because storage throws in a private window
 *  and a popup is not worth a blank page. */
function dismissedKey(category: string) {
  return `advisor-dismissed:${category}`;
}
function wasDismissed(category: string): boolean {
  try {
    return window.localStorage.getItem(dismissedKey(category)) === "1";
  } catch {
    return false;
  }
}
function remember(category: string) {
  try {
    window.localStorage.setItem(dismissedKey(category), "1");
  } catch {
    /* private window: it will ask again next time, which is the lesser bug */
  }
}

export default function AdvisorPopup({
  category,
  href,
  title,
  subtitle,
  image,
}: {
  category: string;
  href: string;
  title: string;
  subtitle?: string;
  image?: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (wasDismissed(category)) return;
    const t = setTimeout(() => setShown(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [category]);

  // Escape closes it, the same as every other dismissible thing on the site.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function close() {
    setShown(false);
    remember(category);
  }

  if (!shown) return null;

  return (
    // No backdrop and no focus trap: this is an offer, not a dialog. It must
    // not stop someone shopping, which is the whole reason it is not the slab
    // any more — so the page behind it stays live and clickable.
    <div
      role="complementary"
      aria-label={title}
      // On a phone it clears the chat launcher as well as the tab bar: the
      // launcher is a 64px button at ~60px up, it is z-80 against this z-40,
      // and at the obvious 4.75rem it painted straight over this card's
      // chevron. 9.25rem puts this above it with ~16px between. The number is
      // written out rather than read from --qc-bottom because QuickChat sets
      // that variable inline on the launcher itself, so a sibling cannot see
      // it. From sm up this moves to the opposite corner and the question
      // does not arise.
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+9.25rem)] z-40 animate-fadeUp sm:inset-x-auto sm:bottom-6 sm:start-6 sm:w-[23rem]"
    >
      <div className="relative flex items-center gap-3.5 rounded-2xl bg-brand-ink p-4 text-white shadow-[0_18px_44px_-12px_rgba(0,53,41,0.55)]">
        <button
          type="button"
          onClick={close}
          aria-label="ปิด"
          className="absolute end-2 top-2 grid size-7 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={14} aria-hidden />
        </button>

        <Link href={href} onClick={close} className="group flex min-w-0 flex-1 items-center gap-3.5">
          {image && (
            <div className="relative size-12 shrink-0">
              <Image src={image} alt="" fill sizes="48px" className="object-contain" />
            </div>
          )}
          <div className="min-w-0 flex-1 pe-5">
            <p className="font-bold leading-tight">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs leading-snug text-white/60">{subtitle}</p>}
          </div>
          <ChevronRight
            size={20}
            aria-hidden
            className="shrink-0 text-white/50 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  );
}

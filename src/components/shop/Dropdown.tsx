"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The shop toolbar's dropdown: a pill that opens a panel under it.
//
// Written by hand rather than on a popover library, because the one
// behaviour that matters on this toolbar is the one a library fights: the
// panel has to stay open while you tick things. Brands and promos are
// multi-select and every tick navigates — a panel that dismisses itself on
// the first one makes picking three brands three round trips. A press counts
// as "inside" if it is in the pill or in the panel, so a tick is never an
// outside press.
//
// The panel is portalled to the body and positioned against the pill, and it
// has to be, for two reasons that both come from where this row lives. On a
// phone the row scrolls sideways, and `overflow-x: auto` computes the other
// axis to `auto` as well — so an absolutely positioned panel was clipped to
// the height of the pill. And the toolbar turns to glass when it sticks, and
// an element with a backdrop-filter becomes the containing block for its
// fixed descendants — so `position: fixed` inside it means the bar, not the
// window, which is the same trap the old filter sheet fell into.
//
// Open state belongs to the caller. The filter row keeps one value for all
// six of its menus so only one can be open at a time; the sort menu is on
// its own and keeps its own.

/** Clear of the window's edges, and of the pill. */
const GUTTER = 12;
const GAP = 8;
/** Kept free at the bottom. A phone has a fixed tab bar down there at a
 *  higher z than this panel, so a panel measured to the full window height
 *  ends with its last row painted over. Reserved at every width: on a
 *  desktop it only means a tall panel stops a little short. */
const FLOOR = 88;

export default function Dropdown({
  label,
  count,
  open,
  onToggle,
  onClose,
  align = "start",
  panelClassName,
  children,
}: {
  label: ReactNode;
  /** Shown on the pill. A closed panel still has to say whether it is doing
   *  anything. Left out where the trigger already names the choice. */
  count?: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** Right-aligned for the menus at the end of the row, so a wide panel
   *  opens inward instead of off the edge of the window. */
  align?: "start" | "end";
  panelClassName?: string;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  // Measured against the pill every time anything could have moved it. The
  // pill is in a sticky bar on a page that scrolls and a row that scrolls
  // sideways, so "where it was when it opened" is only true for an instant.
  const place = useCallback(() => {
    const pill = wrap.current;
    const el = panel.current;
    if (!pill || !el) return;
    const r = pill.getBoundingClientRect();
    const w = el.offsetWidth;
    const wanted = align === "end" ? r.right - w : r.left;
    const left = Math.min(Math.max(GUTTER, wanted), window.innerWidth - w - GUTTER);
    setBox({ top: r.bottom + GAP, left });
  }, [align]);

  // Layout effect so the first paint is already in the right place: with a
  // plain effect the panel shows at 0,0 for a frame and jumps.
  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    // capture, so it also hears the sideways scroll of the row itself rather
    // than only the window's.
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  // Pointerdown, not click: it runs before the next pill's click, so pressing
  // a neighbour closes this one and opens that one in a single press. On
  // click they would race, and the late close would shut the menu that had
  // just opened.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !panel.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const active = (count ?? 0) > 0;

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onToggle}
        className={clsx(
          "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
          active
            ? "border-brand-emerald bg-brand-gradient-soft font-semibold text-brand-800"
            : // Glass only while it is doing nothing. A pill that is holding a
              // filter has to say so louder than the background it is over.
              "glass-pill font-medium text-slate-700",
        )}
      >
        {label}
        {active && (
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={clsx("text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panel}
            role="group"
            aria-label={typeof label === "string" ? label : undefined}
            style={{
              top: box?.top ?? 0,
              left: box?.left ?? 0,
              // Hidden until measured rather than rendered off-position: the
              // measuring pass needs the panel in the document to have a
              // width at all.
              visibility: box ? "visible" : "hidden",
              maxHeight: box ? `calc(100dvh - ${box.top + FLOOR}px)` : undefined,
            }}
            className={clsx(
              "fixed z-70 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-xl2 border border-surface-line bg-white p-3 shadow-card",
              panelClassName,
            )}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

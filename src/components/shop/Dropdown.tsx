"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

// The shop toolbar's dropdown: a pill that opens a panel under it.
//
// Written by hand rather than on a popover library, because the one
// behaviour that matters on this toolbar is the one a library fights: the
// panel has to stay open while you tick things. Brands and promos are
// multi-select and every tick navigates — a panel that dismisses itself on
// the first one makes picking three brands three round trips. Everything
// inside the wrapper counts as "inside", so a tick is never an outside
// press.
//
// Open state belongs to the caller. The filter row keeps one value for all
// five of its menus so only one can be open at a time; the sort menu is on
// its own and keeps its own.

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

  // Pointerdown, not click: it runs before the next pill's click, so pressing
  // a neighbour closes this one and opens that one in a single press. On
  // click they would race, and the late close would shut the menu that had
  // just opened.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) onClose();
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
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onToggle}
        className={clsx(
          "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
          active
            ? "border-brand-emerald bg-brand-gradient-soft font-semibold text-brand-800"
            // Glass only while it is doing nothing. A pill that is holding a
            // filter has to say so louder than the background it is over.
            : "glass-pill font-medium text-slate-700",
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
      {open && (
        <div
          role="group"
          aria-label={typeof label === "string" ? label : undefined}
          className={clsx(
            "absolute top-full z-40 mt-2 max-w-[calc(100vw-2rem)] rounded-xl2 border border-surface-line bg-white p-3 shadow-card",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

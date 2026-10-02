"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

// How wide the inbox's three columns are, and whether the third one is there
// at all.
//
// The widths were fixed at 320 and 300, which is a guess that cannot be right
// for everyone: a long Thai product name wraps to three lines in the list, and
// on a wide monitor the thread in the middle gets a 150-character measure
// nobody wants to read. Staff drag the dividers instead, and the screen
// remembers — per browser, because it is a working preference and not
// something to sync anywhere.
//
// Desktop only. The three panes stack on a phone, where a drag handle between
// them would be a thing to catch with a thumb by mistake.

const KEY = "sl-inbox-layout";

export const LIST_MIN = 240;
export const LIST_MAX = 520;
export const PANEL_MIN = 240;
export const PANEL_MAX = 560;

const DEFAULTS = { list: 320, panel: 300, panelHidden: false };

type Layout = typeof DEFAULTS;

/** A new width, or a function of the current one. */
export type Width = number | ((prev: number) => number);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function useInboxLayout() {
  // Starts at the defaults on both server and client, then reads the stored
  // value after mount: reading localStorage during render would make the
  // first paint differ from the server's and hydration would complain.
  const [layout, setLayout] = useState<Layout>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Layout>;
      setLayout({
        list: clamp(Number(saved.list) || DEFAULTS.list, LIST_MIN, LIST_MAX),
        panel: clamp(Number(saved.panel) || DEFAULTS.panel, PANEL_MIN, PANEL_MAX),
        panelHidden: saved.panelHidden === true,
      });
    } catch {
      // Private window, blocked storage, or something else's key in the way.
      // The defaults are a perfectly good inbox.
    }
  }, []);

  // The drag handlers close over this rather than over `layout`, so a drag
  // that started before a re-render still writes the current values. Kept in
  // step from an effect rather than during render, which React forbids.
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const save = useCallback((next: Layout) => {
    layoutRef.current = next;
    setLayout(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Not being able to remember the width is not a reason to refuse to
      // change it.
    }
  }, []);

  // Takes a width or a function of the current one. Held arrow keys fire
  // several times before React re-renders, and four presses that each read the
  // same stale prop all compute the same answer — so the column moved one
  // step for four presses until these could be given an updater.
  const setList = useCallback(
    (px: Width) => {
      const prev = layoutRef.current;
      const next = typeof px === "function" ? px(prev.list) : px;
      save({ ...prev, list: clamp(next, LIST_MIN, LIST_MAX) });
    },
    [save],
  );
  const setPanel = useCallback(
    (px: Width) => {
      const prev = layoutRef.current;
      const next = typeof px === "function" ? px(prev.panel) : px;
      save({ ...prev, panel: clamp(next, PANEL_MIN, PANEL_MAX) });
    },
    [save],
  );
  const togglePanel = useCallback(
    () => save({ ...layoutRef.current, panelHidden: !layoutRef.current.panelHidden }),
    [save],
  );
  const reset = useCallback(() => save(DEFAULTS), [save]);

  return { layout, setList, setPanel, togglePanel, reset };
}

/**
 * The divider between two columns.
 *
 * `edge` says which side of its own column it sits on, which is what decides
 * the direction of the drag: a handle on a column's right edge grows it when
 * the pointer moves right, one on its left edge grows it when the pointer
 * moves left.
 *
 * Keyboard-operable, because a divider that only a mouse can move is a
 * preference some staff cannot set at all.
 */
export function ColumnResizer({
  edge,
  width,
  min,
  max,
  onResize,
  label,
}: {
  edge: "left" | "right";
  width: number;
  min: number;
  max: number;
  onResize: (px: Width) => void;
  label: string;
}) {
  const [dragging, setDragging] = useState(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);

    const move = (ev: PointerEvent) => {
      const delta = edge === "right" ? ev.clientX - startX : startX - ev.clientX;
      onResize(Math.min(max, Math.max(min, startWidth + delta)));
    };
    const up = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setDragging(false);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 48 : 16;
        const delta =
          e.key === "ArrowLeft"
            ? edge === "right"
              ? -step
              : step
            : e.key === "ArrowRight"
              ? edge === "right"
                ? step
                : -step
              : 0;
        if (delta === 0) return;
        e.preventDefault();
        // An updater rather than a number: see setList/setPanel.
        onResize((w) => Math.min(max, Math.max(min, w + delta)));
      }}
      className={clsx(
        // Sits in the gap between the columns, wider than it looks so it can
        // actually be grabbed: a 1px line is a target nobody hits first try.
        "absolute inset-y-0 z-10 hidden w-3 cursor-col-resize touch-none lg:block",
        edge === "right" ? "-right-3" : "-left-3",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors",
        dragging ? "after:bg-brand-action" : "hover:after:bg-brand-200",
        "focus-visible:outline-hidden focus-visible:after:bg-brand-action",
      )}
    />
  );
}

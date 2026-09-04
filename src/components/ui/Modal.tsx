"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

// A dialog that behaves like one.
//
// The ten hand-rolled `fixed inset-0` overlays in this codebase each solve a
// different subset of the same four problems, and none solves all of them:
// Escape closes it, the background does not scroll behind it, focus is trapped
// inside while it is open and restored to the trigger afterwards, and the
// element is announced as a dialog. Those are the reasons this exists — the
// visual part was never the hard bit.

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  /** Set false for a step the user must not dismiss by accident (e.g. paying). */
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissable?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  // Portals need the DOM, which does not exist during the server render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  // The open/close effect below must run exactly once per open, so it cannot
  // depend on `close`: callers pass an inline `onClose={() => setOpen(false)}`,
  // which is a new function on every render. Depending on it re-ran the whole
  // effect mid-dialog, and each re-run overwrote the "element to restore focus
  // to" with whatever was focused *inside* the dialog — so closing dropped
  // focus onto <body> instead of returning it to the button that opened it.
  // A ref gives the effect the current handler without becoming a dependency.
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus moves into the dialog rather than staying on the page behind it,
    // otherwise the next Tab walks the hidden page.
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const [head] = items;
      const tail = items[items.length - 1];
      // Wrap at both ends so focus cannot escape into the page behind.
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreTo.current?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;

  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
        tabIndex={-1}
        className={clsx(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-xl2 bg-white p-5 shadow-layer-lg",
          "animate-slideUp sm:rounded-xl2 dark:bg-slate-900 dark:text-slate-100",
          width
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-title font-bold text-brand-ink dark:text-slate-100">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="mt-0.5 text-body-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {children}

        {footer && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

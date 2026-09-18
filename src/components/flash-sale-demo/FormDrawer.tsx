"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The campaign form as a panel over the console, sliding in from the right:
 * the list stays where it was, so creating or editing never scrolls the page
 * away from what you were looking at.
 */
export default function FormDrawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while the panel is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-100 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        role="presentation"
      />
      <div
        role="dialog"
        aria-modal={open}
        aria-label={title}
        className={`absolute inset-y-0 right-0 flex w-full max-w-[min(760px,100vw)] flex-col bg-surface-soft shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-surface-line bg-white px-4">
          <h2 className="text-base font-bold text-brand-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-surface-soft hover:text-brand-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{open && children}</div>
      </div>
    </div>
  );
}

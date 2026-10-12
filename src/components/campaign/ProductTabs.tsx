"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

// Tabs over several shelves of products.
//
// Every shelf is rendered on the server and all of them are in the HTML; the
// tabs only decide which one is visible. That is the point: the products are
// in the page for search engines and for anyone whose JavaScript did not
// arrive, and switching tabs costs nothing because there is nothing to fetch.
//
// Hidden with `hidden` rather than by not rendering, so the browser's own
// find-in-page and a screen reader's rotor still find what is in there.
//
// Keyboard behaviour is the tab-list pattern: arrows move between tabs, and
// the tabs themselves are in the tab order once, not five times.

export default function ProductTabs({ labels, panels }: { labels: string[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const base = useId();

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (index + delta + labels.length) % labels.length;
    setActive(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="หมวดสินค้าในแคมเปญ" className="scrollbar-none flex gap-2 overflow-x-auto">
        {labels.map((label, i) => {
          const selected = i === active;
          return (
            <button
              key={label}
              id={`${base}-tab-${i}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${i}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors ${
                selected ? "" : "border border-surface-line text-brand-ink"
              }`}
              style={selected ? { backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" } : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>

      {panels.map((panel, i) => (
        <div
          key={labels[i] ?? i}
          id={`${base}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          className="mt-4"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
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
//
// Used by the campaign pages and by a brand's catalogue. It lives here rather
// than under components/campaign because the second caller is not a campaign,
// and a brand page importing a campaign component is a lie about what the
// code is for.

export default function ProductTabs({
  labels,
  panels,
  ariaLabel = "หมวดสินค้าในแคมเปญ",
  hashKeys,
}: {
  labels: string[];
  panels: ReactNode[];
  /** What the row of tabs is, for a screen reader. */
  ariaLabel?: string;
  /**
   * One key per tab. Given these, the address bar carries the open tab, so a
   * link to #toothpaste opens that tab instead of landing on a hidden shelf —
   * which is what the chips this replaced used to do. Leave it out and the
   * tabs touch neither the hash nor the history.
   */
  hashKeys?: string[];
}) {
  const [active, setActive] = useState(0);
  const base = useId();
  const row = useRef<HTMLDivElement>(null);

  // Read on mount rather than during render: the server has no hash, so
  // choosing the tab from it while rendering would make the first paint
  // disagree with the HTML it is hydrating.
  //
  // And again on hashchange, because a link to #set from somewhere else on
  // this same page changes the address without reloading anything — mount is
  // the one moment that would never come round again.
  useEffect(() => {
    if (!hashKeys) return;

    const fromHash = () => {
      const key = decodeURIComponent(window.location.hash.slice(1));
      const found = hashKeys.indexOf(key);
      if (found < 0) return;
      setActive(found);

      // A tab chosen by the address rather than by a finger can be well off
      // the right of a phone's screen: arriving at #set on a brand with ten
      // kinds of product used to show the gift sets with every visible tab
      // looking unselected. Scrolled by hand rather than with scrollIntoView,
      // which would also move the page itself to reach it.
      const list = row.current;
      const tab = document.getElementById(`${base}-tab-${found}`);
      if (!list || !tab) return;
      list.scrollLeft += tab.getBoundingClientRect().left - list.getBoundingClientRect().left - 16;
    };

    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [hashKeys, base]);

  function open(index: number) {
    setActive(index);
    // replaceState, not a new hash: moving between tabs is looking around one
    // page, and it should not take a dozen presses of Back to leave it.
    if (hashKeys?.[index]) {
      window.history.replaceState(null, "", `#${encodeURIComponent(hashKeys[index])}`);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (index + delta + labels.length) % labels.length;
    open(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  }

  return (
    <div>
      <div
        ref={row}
        role="tablist"
        aria-label={ariaLabel}
        className="scrollbar-none flex gap-2 overflow-x-auto"
      >
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
              onClick={() => open(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors ${
                selected ? "" : "border border-surface-line bg-white text-brand-ink hover:border-brand-teal hover:text-brand-800"
              }`}
              // The campaign page defines these two; anywhere else they fall
              // back to the shop's own colour, so the selected tab is the
              // brand's green on a brand page and the campaign's colour on a
              // campaign — without either page having to say so.
              style={
                selected
                  ? {
                      backgroundColor: "var(--cp-accent, var(--color-brand-800))",
                      color: "var(--cp-on-accent, #ffffff)",
                    }
                  : undefined
              }
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

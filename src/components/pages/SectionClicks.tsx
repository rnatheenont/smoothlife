"use client";

import { useEffect } from "react";

// Counting which section people press, without counting people.
//
// One listener on the document rather than one per section: a page can hold
// twenty sections, and twenty listeners to answer one question is nineteen
// too many.
//
// Finding the section a click belongs to: every section is preceded by a
// zero-height anchor carrying its id (see lib/pages/render.tsx), so walking
// up from whatever was pressed until a node's previous sibling is one of
// those anchors gives the section without wrapping anything in a div. The
// wrapper was the obvious alternative and it would have changed what counts
// as the first child of every section on the site.
//
// Counts are batched and sent once, on the way out, with sendBeacon — the
// request that matters most is the one that happens as the page is being
// left, which is exactly the request fetch() is allowed to cancel.
//
// Nothing identifying is collected or sent: section id, page, and a number.

export default function SectionClicks({ kind, slug }: { kind: string; slug: string }) {
  useEffect(() => {
    const counts = new Map<string, number>();

    function sectionOf(start: Element | null): string | null {
      let el: Element | null = start;
      while (el && el !== document.body) {
        const prev = el.previousElementSibling as HTMLElement | null;
        const id = prev?.dataset?.sectionAnchor;
        if (id) return id;
        el = el.parentElement;
      }
      return null;
    }

    function onClick(event: MouseEvent) {
      // Only things that do something. Pressing a paragraph is not a signal.
      const target = (event.target as Element | null)?.closest("a, button, [role='button']");
      if (!target) return;
      const id = sectionOf(target);
      if (!id) return;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    function flush() {
      if (counts.size === 0) return;
      const body = JSON.stringify({ kind, slug, sections: Object.fromEntries(counts) });
      counts.clear();
      try {
        // A Blob with the JSON type, because sendBeacon sends text/plain
        // otherwise and the route would not parse it.
        navigator.sendBeacon?.("/api/page-clicks", new Blob([body], { type: "application/json" }));
      } catch {
        // A lost count is a missing row in a report, and this is running
        // while somebody is trying to leave the page.
      }
    }

    // pagehide rather than unload: unload does not fire on mobile Safari at
    // all, which is most of this shop's traffic. visibilitychange catches
    // the app being backgrounded, which is how a phone usually leaves.
    function onHide() {
      if (document.visibilityState === "hidden") flush();
    }

    document.addEventListener("click", onClick, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [kind, slug]);

  return null;
}

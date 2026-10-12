"use client";

import { useEffect } from "react";
import { promotionParams, pushDataLayer } from "@/lib/analytics";

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
//
// The same listener also reports to GA4 through the dataLayer, because the
// two questions are the same question asked by two audiences: the admin
// screen wants "which section gets used", and the marketing reports want it
// in the same shape as everything else they look at. Doing it here keeps one
// listener and one definition of what a section is — a second observer for
// the same clicks would eventually disagree with this one.
//
// Only sections in the "hero" and "promo" categories are reported as
// promotions. A product shelf is measured as a product list (view_item_list,
// handled by the cards themselves), and calling it a promotion as well would
// double-count the same impression under two names.

export default function SectionClicks({ kind, slug }: { kind: string; slug: string }) {
  useEffect(() => {
    const counts = new Map<string, number>();

    function anchorOf(start: Element | null): HTMLElement | null {
      let el: Element | null = start;
      while (el && el !== document.body) {
        const prev = el.previousElementSibling as HTMLElement | null;
        if (prev?.dataset?.sectionAnchor) return prev;
        el = el.parentElement;
      }
      return null;
    }

    const isPromotion = (anchor: HTMLElement) =>
      anchor.dataset.sectionCategory === "hero" || anchor.dataset.sectionCategory === "promo";

    const paramsFor = (anchor: HTMLElement) =>
      promotionParams({
        pageKind: kind,
        pageSlug: slug,
        sectionId: anchor.dataset.sectionAnchor ?? "",
        sectionLabel: anchor.dataset.sectionLabel ?? anchor.dataset.sectionAnchor ?? "",
        index: Number(anchor.dataset.sectionIndex ?? 0),
      });

    function onClick(event: MouseEvent) {
      // Only things that do something. Pressing a paragraph is not a signal.
      const target = (event.target as Element | null)?.closest("a, button, [role='button']");
      if (!target) return;
      const anchor = anchorOf(target);
      const id = anchor?.dataset.sectionAnchor;
      if (!anchor || !id) return;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (isPromotion(anchor)) pushDataLayer("select_promotion", paramsFor(anchor));
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

    // One impression per section per page view. Half the section on screen is
    // the threshold GA4's own examples use, and "seen" has to mean something
    // more than "existed in a document somebody scrolled past".
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const anchor = entry.target.previousElementSibling as HTMLElement | null;
          const id = anchor?.dataset.sectionAnchor;
          if (!anchor || !id || seen.has(id)) continue;

          // Half of the section, OR half of the screen filled by it. The
          // ratio alone is not enough: a hero banner taller than the window
          // can never be 50% of itself on screen, so a ratio-only rule would
          // silently never report an impression for the biggest thing on the
          // page — which is the one most worth reporting.
          const bigEnough =
            entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= window.innerHeight * 0.5;
          if (!bigEnough) continue;

          seen.add(id);
          observer.unobserve(entry.target);
          if (isPromotion(anchor)) pushDataLayer("view_promotion", paramsFor(anchor));
        }
      },
      // Several thresholds so the callback runs again as a tall section
      // scrolls through, rather than once at the moment it first touches
      // the edge of the screen.
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    for (const anchor of document.querySelectorAll<HTMLElement>("[data-section-anchor]")) {
      const section = anchor.nextElementSibling;
      if (section) observer.observe(section);
    }

    document.addEventListener("click", onClick, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      observer.disconnect();
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [kind, slug]);

  return null;
}

import { ScrollTrigger } from "gsap/ScrollTrigger";

let scheduled = false;

// Images (Next/Image) finishing their async load after ScrollTrigger first
// measures the page shift everything below them, so triggers created early
// end up pointing at scroll offsets that no longer match the final layout
// — their animations then never fire. Refreshing once after the window's
// load event recalculates every registered trigger against final layout.
// Module-level flag (shared by every component that imports this) keeps it
// to one listener regardless of how many ScrollReveal/StaggerGrid/etc.
// instances are mounted on the page.
export function scheduleScrollTriggerRefresh() {
  if (scheduled || typeof window === "undefined") return;
  scheduled = true;
  if (document.readyState === "complete") {
    ScrollTrigger.refresh();
    return;
  }
  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}

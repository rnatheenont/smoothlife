import { z } from "zod";

// Re-exported for server-side callers. Client components must import it from
// ./mobile-tabs-defaults directly, or zod rides along into the browser.
export { MOBILE_TABS_DEFAULT } from "./mobile-tabs-defaults.ts";
import { MOBILE_TABS_DEFAULT } from "./mobile-tabs-defaults.ts";

// The five things the shop is navigated by on a phone.
//
// Five, and the number is part of the design rather than a setting: the bar
// is a row of thumb-sized targets across the bottom of a screen, and a sixth
// makes every one of them too narrow to hit. So the list can be reordered,
// relabelled and repointed — three to five of them — and the grid follows
// whatever is there.
//
// The cart's badge is not a setting either. It appears on whichever tab
// points at /cart, because the number it shows comes from the cart, not from
// this list.
//
// No database import: the bar is a client component. The layout reads the
// document and passes it down — see footer-links.ts for the day that rule
// was learned.

export const mobileTabsSchema = z.object({
  tabs: z
    .array(
      z.object({
        icon: z.string().default(""),
        href: z.string().default(""),
        th: z.string().max(20).default(""),
        en: z.string().max(20).default(""),
      })
    )
    .max(5)
    .default([]),
});

export type MobileTab = z.infer<typeof mobileTabsSchema>["tabs"][number];

export const MOBILE_TABS_SECTION = "mobile_tabs";

/** A tab needs somewhere to go and something to call it. Anything else is a
 *  gap in a row of five, which reads as the app having lost a button. */
export function usableTabs(tabs: MobileTab[]): MobileTab[] {
  const usable = tabs.filter((t) => t.href && t.th && t.icon);
  // Fewer than three is not a navigation bar; fall back rather than draw a
  // row with two things in it.
  return usable.length >= 3 ? usable.slice(0, 5) : MOBILE_TABS_DEFAULT;
}

import { z } from "zod";

// Re-exported so server-side callers keep one import. Client components must
// import it from ./header-links-defaults directly — coming through here drags
// zod into the browser bundle, which is what the split exists to prevent.
export { HEADER_LINKS_DEFAULT } from "./header-links-defaults.ts";
import { HEADER_LINKS_DEFAULT } from "./header-links-defaults.ts";

// The shop's own navigation: the bar under the search box on a wide screen,
// and the drawer behind the hamburger on a narrow one.
//
// The big shop menu is not here. It is built from the catalogue — categories
// and brands the shop actually sells — and a hand-maintained copy of that
// would be wrong the day a category is added. What is here is the editorial
// half: which destinations the shop wants to push this season.
//
// The drawer is a superset of the desktop bar rather than a copy of it: the
// bar is what the design specifies and it drops four destinations that have
// nowhere else to go on a phone. Keeping them as two lists is what lets that
// stay true after an edit.
//
// No database import — the header is a client component, so the layout reads
// this and passes it down.

const link = z.object({
  href: z.string().default(""),
  th: z.string().max(40).default(""),
  en: z.string().max(40).default(""),
});

const drawerLink = link.extend({ icon: z.string().default("") });

export const headerLinksSchema = z.object({
  /** The row under the search box. The entry marked `mega` opens the shop
   *  panel rather than navigating.
   *
   *  The flag is read loosely because the form that edits it is a dropdown,
   *  and a dropdown's value is a string: "true" from the editor and `true`
   *  from a document written before it both have to mean the same thing.
   *  Without this the whole list fails to parse and the header silently
   *  falls back to the built-in one — the worst kind of wrong, because the
   *  page still looks fine. */
  desk: z
    .array(
      link.extend({
        mega: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
      })
    )
    .max(8)
    .default([]),
  /** Pushed to the right of that row. */
  deskUtility: z.array(link).max(4).default([]),
  /** The drawer behind the hamburger. */
  drawer: z.array(drawerLink).max(16).default([]),
});

export type HeaderLinks = z.infer<typeof headerLinksSchema>;

export const HEADER_SECTION = "header_links";

/** A link with no address or no Thai label is a gap in a navigation bar.
 *  Each list falls back on its own, so a mistake in the drawer does not take
 *  the desktop row down with it. */
export function usableHeaderLinks(links: HeaderLinks): HeaderLinks {
  const ok = <T extends { href: string; th: string }>(items: T[], fallback: T[]) => {
    const kept = items.filter((i) => i.href && i.th);
    return kept.length > 0 ? kept : fallback;
  };
  return {
    desk: ok(links.desk, HEADER_LINKS_DEFAULT.desk),
    // The utility row may legitimately be empty — it is two optional links,
    // not navigation, so an empty one is a choice rather than a mistake.
    deskUtility: links.deskUtility.filter((i) => i.href && i.th),
    drawer: ok(links.drawer, HEADER_LINKS_DEFAULT.drawer),
  };
}

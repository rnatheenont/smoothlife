import { z } from "zod";

// Re-exported for server-side callers. Client components must import it from
// ./footer-links-defaults directly, or zod rides along into the browser.
export { FOOTER_COLUMNS_DEFAULT } from "./footer-links-defaults.ts";
import { FOOTER_COLUMNS_DEFAULT } from "./footer-links-defaults.ts";

// The footer's link columns.
//
// Everything else in the footer is tied to something the code owns: the
// payment badges are what checkout actually accepts, the social icons and the
// phone number come from the contact record. The columns are the one part
// that is purely editorial — which pages the shop wants people to find — and
// they are also the part that goes stale, because a page can be added without
// anybody remembering the footer.
//
// Nothing here touches the database. That matters more than it looks: the
// footer is rendered from SiteChrome, which is a client component, so
// anything this file imports is shipped to every browser. The reader lives
// in footer-links-server.ts and is called by the layout, which passes the
// result down as a prop — the same arrangement the shop menu already uses,
// and for the same reason.

export const footerColumnsSchema = z.object({
  columns: z
    .array(
      z.object({
        title: z.string().max(60).default(""),
        links: z
          .array(z.object({ href: z.string().default(""), label: z.string().max(60).default("") }))
          .max(12)
          .default([]),
      })
    )
    .max(5)
    .default([]),
});

export type FooterColumns = z.infer<typeof footerColumnsSchema>["columns"];

export const FOOTER_SECTION = "footer_links";

/** What the footer has shown since it was written. Also what it falls back to
 *  when the document cannot be read — the footer is on every page, so it can
 *  never depend on a database being reachable. */

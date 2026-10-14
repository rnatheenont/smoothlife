import { z } from "zod";

// The strip across the top of every page.
//
// New: the shop has never had one. The ticker above the header is a list of
// what is on sale, chosen by the catalogue; this is one sentence chosen by a
// person — a holiday delivery cut-off, a payment outage, a campaign opening
// at midnight. Those are the messages that currently go out as a deploy or
// not at all.
//
// Off unless somebody turns it on, and that is the whole safety story: the
// default document has `enabled: false`, so publishing it changes nothing
// and the bar appears the moment it is wanted and not before.
//
// No database import here — the bar is drawn inside SiteChrome, which is a
// client component, so the layout reads it and passes it down. See
// footer-links.ts for what happens when that rule is forgotten.

export const announcementSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().max(200).default(""),
  /** Optional: the bar is a link when this is set, plain text when not. */
  href: z.string().max(300).default(""),
  linkLabel: z.string().max(60).default(""),
  tone: z.enum(["brand", "dark", "warning"]).default("brand"),
  /** ISO instants. A bar with a window shows only inside it — so a
   *  "ปิดรับออเดอร์ 31 ธ.ค." can be written in November and forgotten. */
  from: z.string().max(40).default(""),
  until: z.string().max(40).default(""),
});

export type Announcement = z.infer<typeof announcementSchema>;

export const ANNOUNCEMENT_SECTION = "announcement_bar";

export const ANNOUNCEMENT_DEFAULT: Announcement = {
  enabled: false,
  text: "",
  href: "",
  linkLabel: "",
  tone: "brand",
  from: "",
  until: "",
};

/**
 * Whether this bar should be on screen at `now`.
 *
 * Pure, and tested: the window is the part of this that is easy to get
 * wrong and impossible to see. An unparseable date is treated as no bound
 * rather than as "never", because the alternative is a bar that silently
 * stops appearing because somebody typed the date in Thai.
 */
export function announcementVisible(a: Announcement, now: Date): boolean {
  if (!a.enabled || !a.text.trim()) return false;
  const at = now.getTime();
  if (a.from) {
    const from = Date.parse(a.from);
    if (Number.isFinite(from) && at < from) return false;
  }
  if (a.until) {
    const until = Date.parse(a.until);
    if (Number.isFinite(until) && at > until) return false;
  }
  return true;
}

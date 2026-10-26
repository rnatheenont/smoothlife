import { z } from "zod";

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

export const HEADER_LINKS_DEFAULT: HeaderLinks = {
  desk: [
    { href: "/brands", th: "แบรนด์ทั้งหมด", en: "All brands", mega: true },
    { href: "/shop", th: "สินค้าแนะนำ", en: "Recommended", mega: false },
    // The skin check the tab bar has had on a phone from the start: on a wide
    // screen it was reachable only from the home page, which is the one place
    // somebody who has already started shopping is not.
    { href: "/advisor", th: "ประเมินผิว", en: "Skin Check", mega: false },
    { href: "/knowledge", th: "บทความ", en: "Articles", mega: false },
    // เซ็ตสมาชิก and โปรโมชั่น are out of the navigation for now, by
    // request — the same way the affiliate link left it. Out of the drawer
    // below as well: the drawer is a superset of this row, not a second
    // opinion about it, and a destination that is hidden on a desktop and
    // offered on a phone is not hidden. Both pages still exist and still
    // work, and this is four lines to put back.
  ],
  deskUtility: [
    // Labelled "คำถามที่พบบ่อย" and pointed at /help, which is the help hub
    // and not that page. /faq is now the page with that name on it.
    { href: "/faq", th: "คำถามที่พบบ่อย", en: "FAQ" },
    // The affiliate programme is out of the navigation for now, by request.
    // The page itself is still there and still works — this is one line to
    // put back when it is ready to be pushed again.
  ],
  drawer: [
    { href: "/shop", th: "ช้อปสินค้า", en: "Shop", icon: "grid" },
    { href: "/brands", th: "แบรนด์ทั้งหมด", en: "All brands", icon: "tag" },
    { href: "/concern", th: "เลือกตามปัญหาผิว", en: "Shop by Concern", icon: "droplets" },
    { href: "/advisor", th: "ประเมินผิว", en: "Skin Check", icon: "scan" },
    { href: "/ai-assistant", th: "ผู้ช่วย AI", en: "AI Assistant", icon: "sparkles" },
    { href: "/knowledge", th: "ความรู้ความงาม", en: "Beauty Knowledge", icon: "book" },
    { href: "/account/wishlist", th: "รายการโปรด", en: "Wishlist", icon: "heart" },
    { href: "/about", th: "ทำไมต้อง Smooth Life", en: "Why Smooth Life", icon: "shield" },
    { href: "/faq", th: "คำถามที่พบบ่อย", en: "FAQ", icon: "help" },
    { href: "/help", th: "ช่วยเหลือ", en: "Help", icon: "help" },
  ],
};

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

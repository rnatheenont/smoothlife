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
  /** The row under the search box. The first entry opens the shop panel. */
  desk: z.array(link.extend({ mega: z.boolean().default(false) })).max(8).default([]),
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
    { href: "/subscription", th: "เซ็ตสมาชิก", en: "Member sets", mega: false },
    { href: "/knowledge", th: "บทความ", en: "Articles", mega: false },
    { href: "/promotions", th: "โปรโมชั่น", en: "Promotions", mega: false },
  ],
  deskUtility: [
    { href: "/help", th: "คำถามที่พบบ่อย", en: "FAQ" },
    { href: "/account/referral", th: "โปรแกรม Affiliate", en: "Affiliate program" },
  ],
  drawer: [
    { href: "/shop", th: "ช้อปสินค้า", en: "Shop", icon: "grid" },
    { href: "/brands", th: "แบรนด์ทั้งหมด", en: "All brands", icon: "tag" },
    { href: "/promotions", th: "โปรโมชั่น", en: "Promotions", icon: "percent" },
    { href: "/concern", th: "เลือกตามปัญหาผิว", en: "Shop by Concern", icon: "droplets" },
    { href: "/subscription", th: "เซ็ตสมาชิก", en: "Member sets", icon: "repeat" },
    { href: "/ai-assistant", th: "ผู้ช่วย AI", en: "AI Assistant", icon: "sparkles" },
    { href: "/knowledge", th: "ความรู้ความงาม", en: "Beauty Knowledge", icon: "book" },
    { href: "/account/wishlist", th: "รายการโปรด", en: "Wishlist", icon: "heart" },
    { href: "/account/referral", th: "โปรแกรม Affiliate", en: "Affiliate program", icon: "users" },
    { href: "/about", th: "ทำไมต้อง Smooth Life", en: "Why Smooth Life", icon: "shield" },
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

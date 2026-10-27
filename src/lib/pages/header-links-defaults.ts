// Split out of header-links.ts, and the reason is the whole point of the file.
//
// Header.tsx is a client component and needs this one constant. Importing it
// from header-links.ts meant importing that module, which imports zod — and
// zod is 94 KB over the wire. Every visitor was downloading a schema
// validator to find out what the navigation links are called.
//
// The type still comes from the schema next door, as `import type`, which is
// erased at build time and costs nothing. Same split as thai-phone.ts.

import type { HeaderLinks } from "./header-links.ts";

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

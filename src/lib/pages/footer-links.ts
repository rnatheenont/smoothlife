import { z } from "zod";

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
export const FOOTER_COLUMNS_DEFAULT: FooterColumns = [
  {
    title: "ช้อปปิ้ง",
    links: [
      { href: "/shop", label: "สินค้าทั้งหมด" },
      { href: "/brands", label: "แบรนด์ทั้งหมด" },
      { href: "/promotions", label: "โปรโมชั่น" },
      { href: "/concern", label: "เลือกตามปัญหาผิว" },
    ],
  },
  {
    title: "ทำไมต้อง Smooth Life",
    links: [
      { href: "/about", label: "เกี่ยวกับเรา" },
      { href: "/about/quality", label: "คุณภาพและมาตรฐาน" },
      { href: "/about/experts", label: "ผู้เชี่ยวชาญและพาร์ทเนอร์" },
      { href: "/about/sustainability", label: "ความรับผิดชอบต่อสังคม" },
    ],
  },
  {
    title: "ช่วยเหลือและบัญชี",
    links: [
      { href: "/faq", label: "คำถามที่พบบ่อย" },
      { href: "/help", label: "ศูนย์ช่วยเหลือ" },
      { href: "/track", label: "ติดตามพัสดุ" },
      { href: "/help/delivery", label: "การจัดส่งและคืนสินค้า" },
      { href: "/help/payment", label: "การชำระเงิน" },
      { href: "/loyalty", label: "สิทธิสมาชิก" },
      { href: "/stores", label: "สาขาและติดต่อเรา" },
    ],
  },
];

import { z } from "zod";
import { publishedDoc } from "./store";

// The footer's link columns.
//
// Everything else in the footer is tied to something the code owns: the
// payment badges are what checkout actually accepts, the social icons and the
// phone number come from the contact record. The columns are the one part
// that is purely editorial — which pages the shop wants people to find — and
// they are also the part that goes stale, because a page can be added without
// anybody remembering the footer.
//
// Server only: it reads the database. Nothing in the browser needs it.

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
      { href: "/help", label: "ศูนย์ช่วยเหลือ" },
      { href: "/track", label: "ติดตามพัสดุ" },
      { href: "/help/delivery", label: "การจัดส่งและคืนสินค้า" },
      { href: "/help/payment", label: "การชำระเงิน" },
      { href: "/loyalty", label: "สิทธิสมาชิก" },
      { href: "/stores", label: "สาขาและติดต่อเรา" },
    ],
  },
];

/**
 * The columns to draw.
 *
 * A column with no links, or a link with no address, is dropped rather than
 * drawn empty: the footer is the one component on the site that nobody looks
 * at while editing it, so a half-filled row would ship.
 *
 * Any failure — no document, wrong shape, database unreachable — falls back
 * to the built-in columns. The footer never renders without links.
 */
export async function footerColumns(): Promise<FooterColumns> {
  const doc = await publishedDoc("global", "footer");
  const section = doc?.sections.find((s) => s.type === FOOTER_SECTION);
  if (!section) return FOOTER_COLUMNS_DEFAULT;

  const parsed = footerColumnsSchema.safeParse(section.settings);
  if (!parsed.success) {
    console.error("[footer] the stored columns do not fit — using the built-in ones");
    return FOOTER_COLUMNS_DEFAULT;
  }

  const columns = parsed.data.columns
    .map((col) => ({ ...col, links: col.links.filter((l) => l.href && l.label) }))
    .filter((col) => col.title && col.links.length > 0);
  return columns.length > 0 ? columns : FOOTER_COLUMNS_DEFAULT;
}

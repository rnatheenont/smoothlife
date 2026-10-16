import { z } from "zod";
import FlashSaleBar from "@/components/home/FlashSaleBar";
import { lText, tx } from "@/lib/i18n/localized";
import type { CheckIssue, SectionDefinition, SectionProps } from "@/lib/pages/types";

// The flash-sale countdown strip.
//
// Its settings used to live in free_gift_widgets, edited on the Widgets
// screen: the countdown that a campaign lives or dies by was two screens
// away from the page it appears on. They live here now, next to the preview
// that shows the band with the words in it.
//
// The band removes itself when the deadline passes — a flash sale still
// counting "00 : 00 : 00 : 00" the morning after is worse than no flash
// sale — so a section left on the page after a sale costs nothing.

const schema = z.object({
  // The keys keep their "Th" ending although they now hold both languages.
  // Renaming them would mean rewriting every stored document, and this
  // system has no migration step on purpose (see the note in
  // lib/i18n/localized.ts). A wrong-looking key is cheaper than that.
  titleTh: lText(60).default("Flash Sale"),
  subtitleTh: lText(60).default("now on!"),
  /** ISO 8601 with an offset, e.g. 2026-11-11T23:59:00+07:00. Empty means
   *  no countdown: the band shows with its words and its code and no clock. */
  endsAt: z.string().default(""),
  code: z.string().max(40).default(""),
  href: z.string().max(200).default("/promotions"),
  colorFrom: z.string().max(9).default("#0b6b4f"),
  colorTo: z.string().max(9).default("#1bb57a"),
});

type Settings = z.output<typeof schema>;

function Component({ settings, ctx }: SectionProps<Settings>) {
  // The band takes itself off the page when the deadline passes, but it can
  // only notice that on its first tick — in the browser. Drawn from the page
  // it is in the server HTML from the start, so without this an expired sale
  // would flash up on every load before removing itself. On the clock the
  // page already agrees on, so every section on it reads the same moment.
  const ends = settings.endsAt ? new Date(settings.endsAt).getTime() : NaN;
  if (Number.isFinite(ends) && ends <= ctx.now.getTime()) return null;

  // Resolved before it crosses into the band, which is a client component
  // that knows nothing about languages — and whose own `cfg.titleTh || …`
  // fallback would otherwise be handed an object and never fire.
  return (
    <FlashSaleBar
      config={{
        ...settings,
        titleTh: tx(settings.titleTh, ctx.locale),
        subtitleTh: tx(settings.subtitleTh, ctx.locale),
      }}
    />
  );
}

/**
 * Asked before publishing.
 *
 * A deadline already in the past is the one that matters: the band hides
 * itself, so the page publishes looking exactly as if the section were not
 * there, and nothing would say why.
 */
async function check(settings: Settings, ctx: { now: Date }): Promise<CheckIssue[]> {
  if (!settings.endsAt.trim()) return [];
  const ends = new Date(settings.endsAt);
  if (Number.isNaN(ends.getTime())) {
    return [{ level: "error", message: "เวลาหมดอายุอ่านไม่ออก — ใช้รูปแบบ 2026-11-11T23:59:00+07:00" }];
  }
  if (ends.getTime() <= ctx.now.getTime()) {
    return [{ level: "warning", message: "เวลาหมดอายุผ่านไปแล้ว — แถบนี้จะไม่แสดงบนหน้าเว็บ" }];
  }
  return [];
}

export const flashSaleBar: SectionDefinition<typeof schema> = {
  type: "flash_sale_bar",
  version: 2,
  label: "แถบ Flash Sale",
  description: "แถบนับถอยหลังพร้อมโค้ดส่วนลด — หมดเวลาแล้วจะซ่อนตัวเอง",
  category: "promo",
  schema,
  defaults: {
    titleTh: "Flash Sale",
    subtitleTh: "now on!",
    endsAt: "",
    code: "",
    href: "/promotions",
    colorFrom: "#0b6b4f",
    colorTo: "#1bb57a",
  },
  fields: [
    { key: "titleTh", type: "text", label: "หัวข้อ", localized: true },
    { key: "subtitleTh", type: "text", label: "ข้อความบรรทัดรอง", localized: true },
    { key: "endsAt", type: "datetime", label: "หมดเวลาเมื่อ", help: "ว่างไว้ = ไม่มีนาฬิกานับถอยหลัง" },
    { key: "code", type: "text", label: "โค้ดส่วนลด", help: "กดที่โค้ดแล้วคัดลอกได้ · ว่างไว้ = ไม่แสดงโค้ด" },
    { key: "href", type: "text", label: "ลิงก์เมื่อกดหัวข้อ" },
    { key: "colorFrom", type: "color", label: "สีซ้ายของแถบ" },
    { key: "colorTo", type: "color", label: "สีขวาของแถบ" },
  ],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  check,
  Component,
};

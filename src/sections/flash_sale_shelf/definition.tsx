import { z } from "zod";
import FlashSaleShelf from "@/components/home/FlashSaleShelf";
import { getCollectionByHandle } from "@/data/collections";
import type { CheckIssue, SectionDefinition, SectionProps } from "@/lib/pages/types";

// The flash-sale banner with a shelf of products under it.
//
// Settings moved out of free_gift_widgets into the section — see
// flash_sale_bar. The shelf is a collection, so the one setting that can be
// wrong in a way nobody notices is its handle: a typo leaves an empty shelf,
// and the section draws nothing rather than advertising one. check() asks
// about it before publishing instead.

const schema = z.object({
  titleTh: z.string().max(60).default(""),
  /** ISO 8601 with an offset. Empty means no countdown. */
  endsAt: z.string().default(""),
  href: z.string().max(200).default(""),
  collection: z.string().max(120).default(""),
});

type Settings = z.output<typeof schema>;

function Component({ settings }: SectionProps<Settings>) {
  return <FlashSaleShelf config={settings} />;
}

async function check(settings: Settings, ctx: { now: Date }): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = [];
  const handle = settings.collection.trim();

  if (!handle) {
    issues.push({ level: "error", message: "ยังไม่ได้เลือก collection — ชั้นสินค้าจะว่างและ section จะไม่แสดง" });
  } else if (!getCollectionByHandle(handle)) {
    issues.push({ level: "error", message: `ไม่พบ collection "${handle}" — ตรวจตัวสะกดของ handle` });
  }

  if (settings.endsAt.trim()) {
    const ends = new Date(settings.endsAt);
    if (Number.isNaN(ends.getTime())) {
      issues.push({ level: "error", message: "เวลาหมดอายุอ่านไม่ออก — ใช้รูปแบบ 2026-11-11T23:59:00+07:00" });
    } else if (ends.getTime() <= ctx.now.getTime()) {
      issues.push({ level: "warning", message: "เวลาหมดอายุผ่านไปแล้ว — นาฬิกาจะไม่ขึ้น" });
    }
  }

  return issues;
}

export const flashSaleShelf: SectionDefinition<typeof schema> = {
  type: "flash_sale_shelf",
  version: 2,
  label: "ชั้นสินค้า Flash Sale",
  description: "แบนเนอร์ Flash Sale + ชั้นสินค้าจาก collection ที่เลือก",
  category: "promo",
  schema,
  defaults: { titleTh: "", endsAt: "", href: "", collection: "" },
  fields: [
    { key: "collection", type: "text", label: "handle ของ collection", help: "เช่น sale-up-to-50-off" },
    { key: "titleTh", type: "text", label: "หัวข้อบนแบนเนอร์", help: "ว่างไว้ = ใช้ชื่อ collection" },
    { key: "endsAt", type: "datetime", label: "หมดเวลาเมื่อ", help: "ว่างไว้ = ไม่มีนาฬิกานับถอยหลัง" },
    { key: "href", type: "text", label: "ลิงก์เมื่อกดแบนเนอร์", help: "ว่างไว้ = ไปที่ collection นั้น" },
  ],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  check,
  Component,
};

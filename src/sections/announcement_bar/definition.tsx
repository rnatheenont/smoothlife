import { announcementSchema, ANNOUNCEMENT_DEFAULT } from "@/lib/pages/announcement";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The announcement bar's settings, as a form. Draws nothing here — the bar
// itself is rendered by the site chrome on every page.

function Component(_: SectionProps<typeof ANNOUNCEMENT_DEFAULT>) {
  return null;
}

export const announcementBar: SectionDefinition<typeof announcementSchema> = {
  type: "announcement_bar",
  version: 1,
  label: "แถบประกาศ",
  description: "ข้อความหนึ่งบรรทัดบนสุดของทุกหน้า ตั้งช่วงเวลาให้ขึ้นเองและหายเองได้",
  category: "layout",
  schema: announcementSchema,
  defaults: ANNOUNCEMENT_DEFAULT,
  fields: [
    { key: "enabled", type: "toggle", label: "เปิดใช้งาน" },
    { key: "text", type: "text", label: "ข้อความ" },
    { key: "linkLabel", type: "text", label: "ข้อความลิงก์ (ไม่ใส่ก็ได้)" },
    { key: "href", type: "text", label: "ลิงก์ปลายทาง" },
    {
      key: "tone",
      type: "select",
      label: "สี",
      options: [
        ["brand", "เขียวเข้ม"],
        ["dark", "ดำ"],
        ["warning", "เหลืองเตือน"],
      ],
    },
    { key: "from", type: "datetime", label: "เริ่มแสดง", help: "เว้นว่าง = แสดงทันที" },
    { key: "until", type: "datetime", label: "หยุดแสดง", help: "เว้นว่าง = แสดงจนกว่าจะปิดเอง" },
  ],
  enabledOn: ["global"],
  locked: true,
  maxPerPage: 1,
  Component,
};

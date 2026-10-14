import { headerLinksSchema, HEADER_LINKS_DEFAULT } from "@/lib/pages/header-links";
import { NAV_ICON_KEYS } from "@/components/icons/NavIcons";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The header's navigation, as a form. Draws nothing here — the header draws
// it, on every page.

function Component(_: SectionProps<typeof HEADER_LINKS_DEFAULT>) {
  return null;
}

export const headerLinksSection: SectionDefinition<typeof headerLinksSchema> = {
  type: "header_links",
  version: 1,
  label: "เมนูบนและเมนูลิ้นชัก",
  description: "ลิงก์ในแถบบน (จอกว้าง) และในลิ้นชักเมนู — เมนูหมวด/แบรนด์ยังสร้างจากแคตตาล็อกเอง",
  category: "layout",
  schema: headerLinksSchema,
  defaults: HEADER_LINKS_DEFAULT,
  fields: [
    {
      key: "desk",
      type: "list",
      label: "แถบบน (จอกว้าง)",
      item: "ลิงก์",
      max: 8,
      help: 'อันที่ตั้ง mega เป็น "ใช่" คืออันที่เปิดเมนูใหญ่ของหมวด/แบรนด์',
      columns: [
        { key: "th", label: "ข้อความ (ไทย)", half: true },
        { key: "en", label: "ข้อความ (อังกฤษ)", half: true },
        { key: "href", label: "ลิงก์", half: true },
        {
          key: "mega",
          label: "เปิดเมนูใหญ่",
          type: "select",
          options: [
            ["", "ไม่"],
            ["true", "ใช่"],
          ],
          half: true,
        },
      ],
    },
    {
      key: "deskUtility",
      type: "list",
      label: "ลิงก์ชิดขวาในแถบบน",
      item: "ลิงก์",
      max: 4,
      help: "เว้นว่างได้",
      columns: [
        { key: "th", label: "ข้อความ (ไทย)", half: true },
        { key: "en", label: "ข้อความ (อังกฤษ)", half: true },
        { key: "href", label: "ลิงก์" },
      ],
    },
    {
      key: "drawer",
      type: "list",
      label: "ลิ้นชักเมนู (มือถือ)",
      item: "ลิงก์",
      max: 16,
      columns: [
        { key: "icon", label: "ไอคอน", type: "select", options: NAV_ICON_KEYS.map((k) => [k, k] as [string, string]), half: true },
        { key: "href", label: "ลิงก์", half: true },
        { key: "th", label: "ข้อความ (ไทย)", half: true },
        { key: "en", label: "ข้อความ (อังกฤษ)", half: true },
      ],
    },
  ],
  enabledOn: ["global"],
  locked: true,
  maxPerPage: 1,
  Component,
};

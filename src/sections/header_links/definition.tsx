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
      type: "json",
      label: "แถบบน (จอกว้าง)",
      help: "แต่ละอัน: href, th, en, mega — mega: true คืออันที่เปิดเมนูใหญ่",
    },
    { key: "deskUtility", type: "json", label: "ลิงก์ชิดขวาในแถบบน", help: "แต่ละอัน: href, th, en — เว้นว่างได้" },
    {
      key: "drawer",
      type: "json",
      label: "ลิ้นชักเมนู (มือถือ)",
      help: `แต่ละอัน: icon, href, th, en — ไอคอนที่เลือกได้: ${NAV_ICON_KEYS.join(", ")}`,
    },
  ],
  enabledOn: ["global"],
  locked: true,
  maxPerPage: 1,
  Component,
};

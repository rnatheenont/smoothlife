import { contactSchema, CONTACT_DEFAULT } from "@/lib/pages/contact";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The contact details, as a form.
//
// It is a section because that is what the page system stores, but it draws
// nothing: this document is not a page. The pages that show these details use
// contact_channels, and the footer reads them directly. Keeping the fields
// here rather than inventing a second kind of record means the editor, the
// draft/publish cycle, the revision history and the rollback button all work
// on it for free.
//
// Locked, because a global with no fields is a global that silently stops
// overriding anything.

function Component(_: SectionProps<typeof CONTACT_DEFAULT>) {
  return null;
}

export const contactInfoSection: SectionDefinition<typeof contactSchema> = {
  type: "contact_info",
  version: 1,
  label: "ข้อมูลติดต่อ",
  description: "เบอร์โทร เวลาทำการ LINE และโซเชียล — ใช้ร่วมกันทุกที่ที่แสดงข้อมูลติดต่อ",
  category: "content",
  schema: contactSchema,
  defaults: CONTACT_DEFAULT,
  fields: [
    { key: "phoneDisplay", type: "text", label: "เบอร์โทร (ที่แสดง)" },
    { key: "phoneHref", type: "text", label: "เบอร์โทร (สำหรับกดโทร)", help: "เช่น tel:0854890549 — ไม่มีขีดและเว้นวรรค" },
    { key: "hours", type: "text", label: "เวลาทำการ" },
    { key: "lineHandle", type: "text", label: "LINE ID" },
    { key: "lineShopUrl", type: "text", label: "ลิงก์ LINE (ติดตาม)" },
    { key: "lineChatUrl", type: "text", label: "ลิงก์ LINE (ทักแชท)" },
    { key: "facebookUrl", type: "text", label: "Facebook" },
    { key: "instagramUrl", type: "text", label: "Instagram" },
    { key: "tiktokUrl", type: "text", label: "TikTok" },
  ],
  enabledOn: ["global"],
  locked: true,
  maxPerPage: 1,
  Component,
};

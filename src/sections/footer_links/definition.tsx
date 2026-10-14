import { footerColumnsSchema, FOOTER_COLUMNS_DEFAULT } from "@/lib/pages/footer-links";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The footer's link columns, as a form.
//
// Draws nothing, like contact_info: the global document is a record, and the
// thing that renders it is the footer itself, on every page. Keeping it as a
// section is what gives it drafts, publishing and a rollback button without
// building any of those again.

function Component(_: SectionProps<{ columns: typeof FOOTER_COLUMNS_DEFAULT }>) {
  return null;
}

export const footerLinks: SectionDefinition<typeof footerColumnsSchema> = {
  type: "footer_links",
  version: 1,
  label: "ลิงก์ท้ายเว็บ",
  description: "คอลัมน์ลิงก์ในส่วนท้ายของทุกหน้า",
  category: "layout",
  schema: footerColumnsSchema,
  defaults: { columns: FOOTER_COLUMNS_DEFAULT },
  fields: [
    {
      key: "columns",
      type: "json",
      label: "คอลัมน์",
      help: "แต่ละคอลัมน์: title และ links [{ href, label }] — คอลัมน์ที่ไม่มีลิงก์จะไม่ถูกแสดง",
    },
  ],
  enabledOn: ["global"],
  locked: true,
  maxPerPage: 1,
  Component,
};

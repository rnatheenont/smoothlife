import { mobileTabsSchema, MOBILE_TABS_DEFAULT } from "@/lib/pages/mobile-tabs";
import { TAB_ICON_KEYS } from "@/components/icons/TabIcons";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The bottom bar's tabs, as a form. Draws nothing here — the bar itself is
// on every storefront page on a phone.

function Component(_: SectionProps<{ tabs: typeof MOBILE_TABS_DEFAULT }>) {
  return null;
}

export const mobileTabsSection: SectionDefinition<typeof mobileTabsSchema> = {
  type: "mobile_tabs",
  version: 1,
  label: "แท็บล่าง (มือถือ)",
  description: "แถบนำทางล่างสุดบนมือถือ — ใส่ได้ 3 ถึง 5 แท็บ",
  category: "layout",
  schema: mobileTabsSchema,
  defaults: { tabs: MOBILE_TABS_DEFAULT },
  fields: [
    {
      key: "tabs",
      type: "list",
      label: "แท็บ",
      item: "แท็บ",
      max: 5,
      help: "ใส่ได้ 3 ถึง 5 แท็บ · น้อยกว่า 3 จะกลับไปใช้ชุดเดิม",
      columns: [
        { key: "icon", label: "ไอคอน", type: "select", options: TAB_ICON_KEYS.map((k) => [k, k] as [string, string]), half: true },
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

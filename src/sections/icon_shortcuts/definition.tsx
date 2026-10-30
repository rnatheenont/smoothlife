import { SALE_HREF } from "@/lib/sale-destination";
import { z } from "zod";
import CategoryIconRow from "@/components/home/CategoryIconRow";
import { ICON_BY_KEY, ICON_KEYS } from "@/components/icons/CategoryIcons";
import { ICON_THEMES, ICON_THEME_LABEL, type IconTheme } from "@/lib/category-icon-theme";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The round shortcuts under the banners.
//
// Settings are JSON, so a row cannot carry a React component — it carries an
// icon key and the strip looks the mark up (ICON_BY_KEY). A key that no
// longer exists leaves that one shortcut without a mark rather than throwing,
// because a missing picture is a smaller problem than a missing page.

const schema = z.object({
  items: z
    .array(
      z.object({
        href: z.string().min(1),
        label: z.string().min(1).max(24),
        /** One of ICON_KEYS. Leave out when using `word`. */
        icon: z.string().optional(),
        /** A word in place of a mark, the way the sale disc is drawn. */
        word: z.string().max(8).optional(),
      })
    )
    .min(1)
    .max(12),
  /** Which set of marks the discs wear. Validated against the list rather
   *  than taken as a string: a typo here would otherwise point every disc at
   *  a folder that does not exist. */
  theme: z.enum(ICON_THEMES).default("line"),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = settings.items.map((s) => ({
    href: s.href,
    label: s.label,
    word: s.word,
    Icon: s.icon ? ICON_BY_KEY[s.icon] : undefined,
    iconKey: s.icon,
  }));
  return <CategoryIconRow items={items} theme={settings.theme as IconTheme} />;
}

export const iconShortcuts: SectionDefinition<typeof schema> = {
  type: "icon_shortcuts",
  version: 1,
  label: "ทางลัดหมวดหมู่",
  description: "แถวไอคอนกลมใต้แบนเนอร์ กดไปหมวดหมู่หรือคอลเลกชัน",
  category: "layout",
  schema,
  // The nine that were hard-coded in the component, in order.
  defaults: {
    items: [
      { href: SALE_HREF, label: "ลดราคาพิเศษ", word: "Sale" },
      { href: "/brands", label: "แบรนด์แนะนำ", icon: "top-brand" },
      { href: "/shop/skincare", label: "สกินแคร์", icon: "skincare" },
      { href: "/shop/oral-care", label: "ดูแลช่องปาก", icon: "oral-care" },
      { href: "/shop/wellness", label: "วิตามินและอาหารเสริม", icon: "wellness" },
      { href: "/shop/hair-care", label: "ดูแลเส้นผม", icon: "hair-care" },
      { href: "/collections/for-men", label: "สำหรับผู้ชาย", icon: "for-men" },
      { href: "/collections/medical-equipment", label: "อุปกรณ์เสริม", icon: "accessories" },
      { href: "/collections/first-aid-smoothllife", label: "ปฐมพยาบาล", icon: "first-aid" },
    ],
    theme: "line",
  },
  fields: [
    {
      key: "theme",
      type: "select",
      label: "ชุดไอคอน",
      options: ICON_THEMES.map((t) => [t, ICON_THEME_LABEL[t]] as [string, string]),
      help: "ชุดสามมิติและฮาโลวีนมีรูปให้แปดหมวด หมวดที่ไม่มีรูปจะใช้ลายเส้นเดิม",
    },
    {
      key: "items",
      type: "json",
      label: "ทางลัด",
      help: `ไอคอนที่เลือกได้: ${ICON_KEYS.join(", ")} — ฟอร์มจริงมาในเฟสถัดไป`,
    },
  ],
  enabledOn: ["home", "page", "campaign"],
  maxPerPage: 1,
  Component,
};

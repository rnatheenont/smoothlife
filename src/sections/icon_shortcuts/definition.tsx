import { z } from "zod";
import CategoryIconRow from "@/components/home/CategoryIconRow";
import { ICON_BY_KEY, ICON_KEYS } from "@/components/icons/CategoryIcons";
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
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = settings.items.map((s) => ({
    href: s.href,
    label: s.label,
    word: s.word,
    Icon: s.icon ? ICON_BY_KEY[s.icon] : undefined,
  }));
  return <CategoryIconRow items={items} />;
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
      { href: "/collections/sale-up-to-50-off", label: "ลดราคาพิเศษ", word: "Sale" },
      { href: "/brands", label: "แบรนด์แนะนำ", icon: "top-brand" },
      { href: "/shop/skincare", label: "สกินแคร์", icon: "skincare" },
      { href: "/shop/oral-care", label: "ดูแลช่องปาก", icon: "oral-care" },
      { href: "/shop/wellness", label: "วิตามินและอาหารเสริม", icon: "wellness" },
      { href: "/shop/hair-care", label: "ดูแลเส้นผม", icon: "hair-care" },
      { href: "/collections/for-men", label: "สำหรับผู้ชาย", icon: "for-men" },
      { href: "/collections/medical-equipment", label: "อุปกรณ์เสริม", icon: "accessories" },
      { href: "/collections/first-aid-smoothllife", label: "ปฐมพยาบาล", icon: "first-aid" },
    ],
  },
  fields: [
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

import { z } from "zod";
import { ICON_BY_KEY, ICON_KEYS } from "@/components/icons/CategoryIcons";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The promises row: three or four short claims with a mark above each.
//
// This is the shape the shop's hero used to carry (ของแท้ 100% · จัดส่งเร็ว ·
// คืนสินค้าได้). It was taken out of there because it said the same thing on
// every category, but it is a real thing a page sometimes needs — so it is
// here, where a page that wants it can ask for it.

const schema = z.object({
  items: z
    .array(
      z.object({
        icon: z.string().default(""),
        title: z.string().min(1).max(30),
        sub: z.string().max(40).default(""),
      })
    )
    .min(1)
    .max(6),
  background: z.enum(["page", "white", "soft"]).default("soft"),
});

const BACKGROUND: Record<string, string> = { page: "", white: "bg-white", soft: "bg-surface-soft" };

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  return (
    <section className={`${BACKGROUND[settings.background] ?? ""} py-6 md:py-10`}>
      {/* A list, because it is one — three unrelated claims read as three
          things rather than a sentence that lost its punctuation. */}
      <ul className="container-page grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {settings.items.map((item, i) => {
          const Icon = item.icon ? ICON_BY_KEY[item.icon] : undefined;
          return (
            <li key={`${item.title}-${i}`} className="flex flex-col items-center gap-2 text-center">
              {Icon && (
                <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                  <Icon className="h-8 w-8" blobClassName="text-brand-400/45" />
                </span>
              )}
              <span className="text-[13px] font-bold leading-tight text-brand-1000">{item.title}</span>
              {item.sub && <span className="text-[12px] leading-tight text-slate-500">{item.sub}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const uspIcons: SectionDefinition<typeof schema> = {
  type: "usp_icons",
  version: 1,
  label: "แถบจุดเด่น",
  description: "ข้อความสั้นๆ พร้อมไอคอน เรียงเป็นแถว",
  category: "content",
  schema,
  defaults: {
    items: [
      { icon: "all-categories", title: "ของแท้ 100%", sub: "มี อย. ทุกชิ้น" },
      { icon: "wellness", title: "ส่งฟรีทั่วไทย", sub: "ไม่มีขั้นต่ำ" },
      { icon: "top-brand", title: "สะสมคะแนนได้", sub: "ทุกการสั่งซื้อ" },
    ],
    background: "soft",
  },
  fields: [
    { key: "items", type: "json", label: "รายการ", help: `ไอคอนที่เลือกได้: ${ICON_KEYS.join(", ")}` },
    {
      key: "background",
      type: "select",
      label: "พื้นหลัง",
      options: [["page", "ตามพื้นหน้า"], ["white", "ขาว"], ["soft", "เขียวอ่อน"]],
    },
  ],
  enabledOn: ["home", "page", "campaign", "brand"],
  Component,
};

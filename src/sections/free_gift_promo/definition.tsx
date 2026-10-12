import { z } from "zod";
import FreeGiftPromoCard from "@/components/FreeGiftPromoCard";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The free-gift promo cards.
//
// Settings moved out of free_gift_widgets and into the section — see
// deal_of_day for why. The cards themselves are the live free-gift promos,
// so there is nothing to choose here beyond how many of them to show; the
// section draws nothing while no promo is running.

const schema = z.object({
  maxCards: z.number().int().min(1).max(8).default(4),
});

type Settings = z.output<typeof schema>;

function Component({ settings }: SectionProps<Settings>) {
  return (
    <section className="container-page">
      <FreeGiftPromoCard config={settings} />
    </section>
  );
}

export const freeGiftPromo: SectionDefinition<typeof schema> = {
  type: "free_gift_promo",
  version: 2,
  label: "โปรของแถม",
  description: "การ์ดโปรโมชันของแถมที่กำลังใช้งานอยู่ — ไม่มีโปร = ไม่แสดง",
  category: "promo",
  schema,
  defaults: { maxCards: 4 },
  fields: [
    {
      key: "maxCards",
      type: "number",
      label: "แสดงกี่การ์ด",
      min: 1,
      max: 8,
      help: "เรียงตามโปรที่กำลังใช้งาน · จอคอมวางได้แถวละ 4",
    },
  ],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  Component,
};

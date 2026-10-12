import { z } from "zod";
import FreeGiftPromoCard from "@/components/FreeGiftPromoCard";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The free-gift promo card. Collapses to nothing while its widget is off —
// see deal_of_day for why there is no padding here.

const schema = z.object({});

function Component(_props: SectionProps<z.output<typeof schema>>) {
  return (
    <section className="container-page">
      <FreeGiftPromoCard />
    </section>
  );
}

export const freeGiftPromo: SectionDefinition<typeof schema> = {
  type: "free_gift_promo",
  version: 1,
  label: "โปรของแถม",
  description: "การ์ดโปรโมชันของแถม — เปิด/ปิดและตั้งค่าที่หน้า Widgets",
  category: "promo",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  Component,
};

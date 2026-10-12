import { z } from "zod";
import DealOfTheDayCard from "@/components/DealOfTheDayCard";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Deal of the day.
//
// The wrapper carries no vertical padding on purpose: the card owns its own
// margin, so when the widget behind it is off — which is the default — the
// section collapses to nothing instead of leaving a tall padded gap with
// nothing in it.

const schema = z.object({});

function Component(_props: SectionProps<z.output<typeof schema>>) {
  return (
    <section className="container-page">
      <DealOfTheDayCard />
    </section>
  );
}

export const dealOfDay: SectionDefinition<typeof schema> = {
  type: "deal_of_day",
  version: 1,
  label: "ดีลประจำวัน",
  description: "การ์ดดีลของวัน — เปิด/ปิดและตั้งค่าที่หน้า Widgets",
  category: "promo",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  Component,
};

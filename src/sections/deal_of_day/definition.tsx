import { z } from "zod";
import DealOfTheDayCard from "@/components/DealOfTheDayCard";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Deal of the day.
//
// Its settings used to live in free_gift_widgets and be edited on the
// Widgets screen, which meant adding this section to a page drew nothing at
// all until somebody found the matching toggle somewhere else. They live
// here now: the words are edited where the card is, and whether it appears
// is whether the section is on the page — the eye icon, like every other
// section.
//
// The wrapper carries no vertical padding on purpose: the card owns its own
// margin, so when there is no promo to show the section collapses to nothing
// instead of leaving a tall padded gap.

const schema = z.object({
  headlineTh: z.string().max(80).default("ดีลวันนี้ รับของแถมได้เลย"),
  ctaTh: z.string().max(40).default("รับเลย"),
  /** The rolling window used when the promo itself carries no expiry date. */
  endsInHours: z.number().int().min(1).max(168).default(24),
});

type Settings = z.output<typeof schema>;

function Component({ settings }: SectionProps<Settings>) {
  return (
    <section className="container-page">
      <DealOfTheDayCard config={settings} />
    </section>
  );
}

export const dealOfDay: SectionDefinition<typeof schema> = {
  type: "deal_of_day",
  version: 2,
  label: "ดีลประจำวัน",
  description: "การ์ดดีลของวัน พร้อมนับถอยหลัง — แสดงเมื่อมีโปรของแถมที่รับได้",
  category: "promo",
  schema,
  defaults: { headlineTh: "ดีลวันนี้ รับของแถมได้เลย", ctaTh: "รับเลย", endsInHours: 24 },
  fields: [
    { key: "headlineTh", type: "text", label: "หัวข้อ" },
    { key: "ctaTh", type: "text", label: "ข้อความปุ่ม" },
    {
      key: "endsInHours",
      type: "number",
      label: "นับถอยหลังกี่ชั่วโมง",
      min: 1,
      max: 168,
      help: "ใช้เมื่อโปรนั้นไม่ได้ตั้งวันหมดอายุไว้เอง · ถ้าตั้งไว้ จะนับตามวันของโปร",
    },
  ],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  Component,
};

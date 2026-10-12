import { z } from "zod";
import FlashSaleBar from "@/components/home/FlashSaleBar";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The flash-sale strip. It draws itself from a widget the admin already
// edits in WidgetsPanel and renders nothing at all until that widget is
// switched on, so having it on the page costs nothing while it is off.
//
// Its settings stay in free_gift_widgets for now rather than moving in here:
// the plan moves them in Phase 4, and two places to edit the same countdown
// in the meantime is how a sale ends up with two different end times.

const schema = z.object({});

function Component(_props: SectionProps<z.output<typeof schema>>) {
  return <FlashSaleBar />;
}

export const flashSaleBar: SectionDefinition<typeof schema> = {
  type: "flash_sale_bar",
  version: 1,
  label: "แถบ Flash Sale",
  description: "แถบนับถอยหลัง — เปิด/ปิดและตั้งค่าที่หน้า Widgets",
  category: "promo",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  Component,
};

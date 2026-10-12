import { z } from "zod";
import FlashSaleShelf from "@/components/home/FlashSaleShelf";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The shelf of flash-sale products, under the strip. Same arrangement as
// flash_sale_bar: the widget decides whether it appears at all.

const schema = z.object({});

function Component(_props: SectionProps<z.output<typeof schema>>) {
  return <FlashSaleShelf />;
}

export const flashSaleShelf: SectionDefinition<typeof schema> = {
  type: "flash_sale_shelf",
  version: 1,
  label: "ชั้นสินค้า Flash Sale",
  description: "แถวสินค้าในรอบ Flash Sale — เปิด/ปิดและตั้งค่าที่หน้า Widgets",
  category: "promo",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  Component,
};

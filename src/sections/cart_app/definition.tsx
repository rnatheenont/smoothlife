import { z } from "zod";
import CartView from "@/app/cart/CartView";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The cart.
//
// Locked, and of all the locks in this library this is the least arguable:
// the lines, the quantity controls, the coupon picker, the totals and the
// checkout button are one component sharing one piece of state, and a cart
// that can be removed from the cart page is a shop that cannot take an order.
//
// It draws outside the page container on purpose — the cart paints its own
// tinted ground on phones (bg-surface-soft, white sheets laid on it) and
// carries its own container inside that.
//
// Nothing to configure. What this section is *for* is the space around it:
// a document means somebody can put a voucher strip or a line of copy above
// the cart without a deploy, which is the one thing this page has never had.

const schema = z.object({});

function Component({}: SectionProps<z.output<typeof schema>>) {
  return <CartView />;
}

export const cartApp: SectionDefinition<typeof schema> = {
  type: "cart_app",
  version: 1,
  label: "ตะกร้าสินค้า",
  description: "รายการในตะกร้า คูปอง ยอดรวม และปุ่มชำระเงิน — ล็อก ลบออกจากหน้าไม่ได้",
  category: "product",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  Component,
};

import { PAGES_WAVE4_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import CartView from "./CartView";

/**
 * The page, from its document when wave 4 is on and from CartView when it is
 * not. Both halves draw the same CartView, so the cart itself is the same
 * cart either way; what the document adds is somewhere to put a block above
 * or below it — a voucher strip during a sale, a note about delivery over a
 * holiday — without a deploy.
 *
 * A server component, because a file marked "use client" cannot render one,
 * and SystemPageBody is one.
 */
export default function CartPage() {
  if (PAGES_WAVE4_ENABLED) return <SystemPageBody pageKey="cart" />;
  return <CartView />;
}

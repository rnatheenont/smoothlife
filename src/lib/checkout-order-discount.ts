import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { FREE_GIFT_COLUMNS, rowToPromo, type FreeGiftPromoRow } from "@/data/free-gifts";
import { orderDiscountFrom, type OrderDiscount } from "./order-discounts";
import type { CartLine } from "@/data/coupons";

// The order discount this checkout has earned, read and decided on the
// server.
//
// Same shape as the gift side and for the same reason: the cart works out a
// figure and shows it to the shopper, but what the card is charged cannot be
// a number the browser sent. This re-reads the campaigns and re-evaluates
// them against the lines the route resolved.

export async function orderDiscountForCheckout(lines: CartLine[]): Promise<OrderDiscount | null> {
  if (!supabaseConfigured() || lines.length === 0) return null;
  try {
    const rows = await supabaseRest<FreeGiftPromoRow[]>(
      `free_gift_promos?active=eq.true&select=${FREE_GIFT_COLUMNS}`,
    );
    return orderDiscountFrom(rows.map(rowToPromo), lines, Date.now());
  } catch (err) {
    // No discount is the safe direction to fail in: the shopper is charged
    // the full price they can see rather than the checkout collapsing.
    console.error("[checkout-order-discount] could not read promos", err);
    return null;
  }
}

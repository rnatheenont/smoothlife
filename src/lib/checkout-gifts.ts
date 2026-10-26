import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { FREE_GIFT_COLUMNS, rowToPromo, type FreeGiftPromoRow } from "@/data/free-gifts";
import { giftLinesFrom, type CheckoutGiftLine } from "./checkout-gifts-rules";
import type { CartLine } from "@/data/coupons";
import { getProductBySlug } from "@/data/products";
import { freeGiftProducts } from "@/lib/shopify-admin";

// Which gifts this order actually gets, decided here rather than taken from
// the browser.
//
// The cart works out the same thing for the shopper, and what it works out is
// a promise: a line that says "free" next to the thing they are about to pay
// for. Until now that promise stopped at the checkout button — the gift lines
// were dropped before the order was built, because the gifts were handed out
// by an app on Shopify's side and a second hand reaching into the same cart
// would have given the shopper two.
//
// An order this shop builds itself does not go through Shopify's checkout, so
// Shopify's automatic discounts never run on it. That is the whole reason this
// exists: the only way a gift reaches an order we create is if we put it there.
//
// Everything is re-read from the database and re-evaluated against the lines
// the server resolved, for the same reason prices are: what the browser sends
// is a claim, and this one is worth money.

export type { CheckoutGiftLine };

/**
 * @param lines the lines the server resolved, at the prices it resolved them to
 */
export async function giftLinesForCheckout(lines: CartLine[]): Promise<CheckoutGiftLine[]> {
  if (!supabaseConfigured() || lines.length === 0) return [];

  let rows: FreeGiftPromoRow[];
  try {
    rows = await supabaseRest<FreeGiftPromoRow[]>(
      `free_gift_promos?active=eq.true&select=${FREE_GIFT_COLUMNS}`,
    );
  } catch (err) {
    // A gift nobody can look up is a gift this order does without. The
    // alternative — failing the checkout — costs the shop the sale as well.
    console.error("[checkout-gifts] could not read promos", err);
    return [];
  }

  let stock = new Map<string, number | null>();
  try {
    stock = new Map((await freeGiftProducts()).map((g) => [g.variantId, g.stock]));
  } catch (err) {
    // Unknown stock is not zero stock — the promo stands, the same way the
    // storefront treats it.
    console.error("[checkout-gifts] could not read gift stock", err);
  }

  return giftLinesFrom(
    rows.map(rowToPromo),
    lines,
    stock,
    Date.now(),
    (slug) => getProductBySlug(slug)?.variants[0]?.variantId,
  );
}


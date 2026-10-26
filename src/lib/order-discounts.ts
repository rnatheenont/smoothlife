import {
  evaluateActiveFreeGifts,
  triggerAmount,
  qualifyingLines,
  type FreeGiftPromo,
} from "../data/free-gifts.ts";
import type { CartLine } from "../data/coupons.ts";

// Money off the order, from the same ladders that hand over gifts.
//
// The app on Shopify sells these as two more campaign types — "Order Goal"
// (bigger discounts at higher spending tiers) and "Volume Discount" (a
// discount once you buy enough items) — but they are the ladder this codebase
// already evaluates, with the reward at the top being a number rather than a
// product. Everything that decides *whether* a campaign applies is therefore
// shared: the tiers, the trigger in baht or items, the scope, the exclusions.
//
// What is not shared is the arithmetic, because this one comes off the total
// a card is charged.

export type OrderDiscount = {
  promoSlug: string;
  titleTh: string;
  titleEn: string;
  /** Baht off the order, already rounded to whole baht. */
  amount: number;
  /** What was reached, for the line the shopper reads. */
  label: string;
};

/** The discount a single reached tier is worth against this subtotal. */
function tierValue(
  subtotal: number,
  type: "free" | "percentage" | "fixed" | undefined,
  value: number | undefined,
): number {
  if (!value || value <= 0) return 0;
  // "free" on an order discount would mean a free order. It is the default of
  // the dropdown, not an instruction, so it is worth nothing here.
  if (type === "fixed") return Math.min(Math.round(value), subtotal);
  if (type === "percentage") return Math.round((subtotal * Math.min(value, 100)) / 100);
  return 0;
}

/**
 * The best order discount this basket has earned.
 *
 * One, not all of them: two campaigns stacking on the same order is how a
 * shop gives away more than it meant to, and the app pays a single tier too.
 * When several apply, the shopper gets the largest — the one they would
 * rightly expect to see.
 *
 * `subtotalFor` is the money the discount is taken off. It is the whole
 * basket, not just the lines that qualified the campaign: a campaign scoped
 * to one brand still discounts the order it unlocked, which is what "10% off
 * your order" says.
 */
export function orderDiscountFrom(
  all: FreeGiftPromo[],
  lines: CartLine[],
  now: number,
): OrderDiscount | null {
  const promos = all.filter(
    (p) =>
      p.rewardType === "order_discount" &&
      p.displayOnly === false &&
      !(p.starts && new Date(p.starts).getTime() > now) &&
      !(p.expires && new Date(p.expires).getTime() < now),
  );
  if (promos.length === 0) return null;

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  if (subtotal <= 0) return null;

  let best: OrderDiscount | null = null;

  for (const evaluated of evaluateActiveFreeGifts(promos, lines)) {
    if (!evaluated.eligible) continue;
    const { promo } = evaluated;
    const reached = triggerAmount(promo, lines);

    // A ladder pays its highest reached rung; a flat campaign pays itself.
    let amount = 0;
    let label = "";
    if (promo.kind === "tiered") {
      const tiers = [...(promo.tiers ?? [])]
        .sort((a, b) => a.minSubtotal - b.minSubtotal)
        .filter((t) => reached >= t.minSubtotal);
      const top = tiers[tiers.length - 1];
      if (!top) continue;
      amount = tierValue(subtotal, top.discountType ?? promo.discountType, top.discountValue ?? promo.discountValue);
      label =
        promo.triggerType === "quantity"
          ? `ซื้อครบ ${top.minSubtotal} ชิ้น`
          : `ซื้อครบ ฿${top.minSubtotal.toLocaleString()}`;
    } else {
      amount = tierValue(subtotal, promo.discountType, promo.discountValue);
      label = promo.titleTh;
    }

    if (amount <= 0) continue;
    if (!best || amount > best.amount) {
      best = { promoSlug: promo.slug, titleTh: promo.titleTh, titleEn: promo.titleEn, amount, label };
    }
  }

  return best;
}

/** Whether a campaign is one of these at all — used by the widgets, which
 *  must not draw a gift tile for a campaign that hands over no gift. */
export function isOrderDiscount(promo: { rewardType?: string }): boolean {
  return promo.rewardType === "order_discount";
}

export { qualifyingLines };

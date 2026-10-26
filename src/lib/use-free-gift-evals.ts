"use client";

import { useMemo } from "react";
import { evaluateActiveFreeGifts, FreeGiftEval } from "@/data/free-gifts";
import { CartLine } from "@/data/coupons";
import { useCart } from "@/lib/cart-context";

// Shared eligibility computation so every widget (Milestone bar, Deal of the
// day, Tiered box, Pop-up, Congrats bar, Floating button, ...) reads the
// exact same evals instead of recomputing evaluateActiveFreeGifts itself.
// scopedToSlug narrows to promos relevant to one product (buy-trigger or
// gift) — used by the product-detail inline card.
export function useFreeGiftEvals(scopedToSlug?: string): FreeGiftEval[] {
  const { lines, giftPromos } = useCart();

  const cartLines: CartLine[] = lines
    .filter((l) => !l.isGift)
    .map((l) => ({ slug: l.slug, qty: l.qty, price: l.price, brand: l.brand, category: l.category as CartLine["category"] }));

  // A promo nobody can reach from this page is noise on it; a promo this page
  // is a step toward is the opposite. "Spend ฿990" is reached by buying
  // anything at all, so it belongs on every product page — leaving it out is
  // what made the product pages silent about the only kind of promo the shop
  // actually runs. Same for "buy any 3", which is a bxgy with no list.
  const reachableFromAnything = (p: (typeof giftPromos)[number]) =>
    p.kind === "spend" || p.kind === "tiered" || (p.buyProductSlugs ?? []).length === 0;

  // An Order Goal / Volume Discount campaign hands over no product, so the
  // gift widgets have nothing to draw for it — the cart shows it as a line on
  // the total instead. Leaving it in here would put an empty tile on the
  // shelf and a gift popup over a campaign that gave no gift.
  const giftPromosOnly = giftPromos.filter((p) => p.rewardType !== "order_discount");

  const promos = scopedToSlug
    ? giftPromosOnly.filter(
        (p) =>
          reachableFromAnything(p) ||
          p.giftProductSlug === scopedToSlug ||
          (p.buyProductSlugs ?? []).includes(scopedToSlug) ||
          (p.tiers ?? []).some((t) => t.giftProductSlug === scopedToSlug)
      )
    : giftPromosOnly;

  return useMemo(
    () => evaluateActiveFreeGifts(promos, cartLines),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(cartLines), JSON.stringify(promos)]
  );
}

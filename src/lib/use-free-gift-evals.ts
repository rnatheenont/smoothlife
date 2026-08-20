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

  const promos = scopedToSlug
    ? giftPromos.filter(
        (p) =>
          p.giftProductSlug === scopedToSlug ||
          (p.buyProductSlugs ?? []).includes(scopedToSlug) ||
          (p.tiers ?? []).some((t) => t.giftProductSlug === scopedToSlug)
      )
    : giftPromos;

  return useMemo(
    () => evaluateActiveFreeGifts(promos, cartLines),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(cartLines), JSON.stringify(promos)]
  );
}

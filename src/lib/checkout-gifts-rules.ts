import {
  evaluateActiveFreeGifts,
  type FreeGiftPromo,
} from "../data/free-gifts.ts";
import type { CartLine } from "../data/coupons.ts";

// The rules that decide which gifts an order gets, with nothing to fetch.
//
// Separate from checkout-gifts.ts, which does the fetching, because this is
// the part worth testing and the other part is three network calls. Anything
// it needs from elsewhere — the catalogue, the shelf — is handed in.

export type CheckoutGiftLine = {
  variantId: string;
  quantity: number;
  /** Always zero. The line is the gift; the shopper pays nothing for it. */
  price: 0;
  /** Which promo granted it, so a refund or a question has something to read. */
  promoSlug: string;
};

/**
 * The decision itself, with nothing to fetch — which is what makes it
 * testable. Everything it needs has already been read by the caller.
 *
 * @param stock what is left of each gift variant, by variant id. A variant
 *   missing from the map is a gift nobody could count, which is not the same
 *   as a gift at zero and is treated as available.
 */
export function giftLinesFrom(
  all: FreeGiftPromo[],
  lines: CartLine[],
  stock: Map<string, number | null>,
  now: number,
  /** How a catalogue slug becomes a Shopify variant. Handed in so this file
   *  does not have to load the catalogue to be run. */
  variantOfProduct: (slug: string) => string | undefined,
): CheckoutGiftLine[] {
  const promos = all
    // Only a promo that says outright it is not display-only is granted here.
    // Display-only ones belong to the app on Shopify's side, which adds its
    // own line — ours next to it is how a shopper ends up with two — and a
    // row that does not say is a row written before anyone had to choose.
    // Giving a gift away on a guess is the expensive direction to be wrong in.
    .filter((p) => p.displayOnly === false)
    .filter((p) => !(p.starts && new Date(p.starts).getTime() > now))
    .filter((p) => !(p.expires && new Date(p.expires).getTime() < now));
  if (promos.length === 0) return [];

  // A promo whose gift ran out is not granted: an order carrying a line the
  // warehouse cannot pick is worse than an order without the gift, because
  // somebody has to tell the customer about it afterwards.
  const inStock = (variantId: string) => {
    const left = stock.get(variantId);
    return !(typeof left === "number" && left <= 0);
  };

  /** The gift's Shopify variant: off the free-gift shelf, or from the catalogue. */
  const variantFor = (giftVariantId?: string, giftProductSlug?: string) =>
    giftVariantId ?? (giftProductSlug ? variantOfProduct(giftProductSlug) : undefined);

  const out: CheckoutGiftLine[] = [];
  for (const evaluated of evaluateActiveFreeGifts(promos, lines)) {
    if (!evaluated.eligible) continue;
    const { promo, unlockedTiers } = evaluated;

    if (unlockedTiers?.length) {
      for (const tier of unlockedTiers) {
        const variantId = variantFor(tier.giftVariantId, tier.giftProductSlug);
        if (!variantId || !inStock(variantId)) continue;
        out.push({
          variantId,
          quantity: tier.giftQty,
          price: 0,
          promoSlug: `${promo.slug}::tier-${tier.tierIndex}`,
        });
      }
      continue;
    }

    const variantId = variantFor(promo.giftVariantId, promo.giftProductSlug);
    if (!variantId || !inStock(variantId)) continue;
    out.push({ variantId, quantity: promo.giftQty, price: 0, promoSlug: promo.slug });
  }

  // One line per variant. Two promos can land on the same gift, and an order
  // with the same variant twice is one Shopify merges on its own terms.
  const merged = new Map<string, CheckoutGiftLine>();
  for (const line of out) {
    const seen = merged.get(line.variantId);
    if (seen) seen.quantity += line.quantity;
    else merged.set(line.variantId, { ...line });
  }
  return [...merged.values()];
}

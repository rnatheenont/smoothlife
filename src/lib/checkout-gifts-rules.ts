import {
  evaluateActiveFreeGifts,
  giftsOf,
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
  /** Which promo granted it, so a refund or a question has something to read,
   *  and so the Shopify order can be tagged with it. Two promos landing on the
   *  same gift merge into one line and keep both slugs, comma-separated. */
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
  const variantFor = (item: { variantId?: string; productSlug?: string }) =>
    item.variantId ?? (item.productSlug ? variantOfProduct(item.productSlug) : undefined);

  // One promo can hand over several things — the ฿1,599 tier the shop runs
  // today gives four. Each is its own line, and each is checked against the
  // shelf on its own: one of them running out does not cancel the rest.
  const take = (
    out: CheckoutGiftLine[],
    source: Parameters<typeof giftsOf>[0],
    promoSlug: string,
  ) => {
    for (const item of giftsOf(source)) {
      const variantId = variantFor(item);
      if (!variantId || !inStock(variantId)) continue;
      out.push({ variantId, quantity: item.qty, price: 0, promoSlug });
    }
  };

  const out: CheckoutGiftLine[] = [];
  for (const evaluated of evaluateActiveFreeGifts(promos, lines)) {
    if (!evaluated.eligible) continue;
    const { promo, unlockedTiers } = evaluated;

    if (unlockedTiers?.length) {
      for (const tier of unlockedTiers) {
        take(out, tier, `${promo.slug}::tier-${tier.tierIndex}`);
      }
      continue;
    }

    take(out, promo, promo.slug);
  }

  // One line per variant. Two promos can land on the same gift, and an order
  // with the same variant twice is one Shopify merges on its own terms.
  const merged = new Map<string, CheckoutGiftLine>();
  for (const line of out) {
    const seen = merged.get(line.variantId);
    if (seen) {
      seen.quantity += line.quantity;
      // Both promos gave this, and the order should say so — dropping the
      // second slug would make one campaign's giveaway invisible in every
      // report that counts by tag.
      const slugs = new Set(seen.promoSlug.split(","));
      slugs.add(line.promoSlug);
      seen.promoSlug = [...slugs].join(",");
    } else merged.set(line.variantId, { ...line });
  }
  return [...merged.values()];
}

/** What to tag an order with, read off the lines it is about to be created
 *  from.
 *
 *  A gift is a ฿0 line among paid ones and nothing else, so an order that gave
 *  three things away looks, in every Shopify report, exactly like one that gave
 *  none. The flat `free-gift` tag answers "which orders carried a gift"; the
 *  per-promo ones answer "what did this campaign cost us", which is the
 *  question actually worth asking at the end of a campaign.
 *
 *  Tier slugs arrive as `promo::tier-1`; the campaign is the promo, so the
 *  tier is dropped — otherwise each tier would count as its own campaign. */
export function giftOrderTags(lines: { price: number; promoSlug?: string }[]): string[] {
  const slugs = new Set<string>();
  for (const line of lines) {
    if (line.price !== 0 || !line.promoSlug) continue;
    for (const slug of line.promoSlug.split(",")) {
      const promo = slug.split("::")[0].trim();
      if (promo) slugs.add(promo);
    }
  }
  if (slugs.size === 0) return [];
  return ["free-gift", ...[...slugs].sort().map((s) => `free-gift:${s}`)];
}

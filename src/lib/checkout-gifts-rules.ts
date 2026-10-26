import {
  evaluateActiveFreeGifts,
  giftsOf,
  type FreeGiftPromo,
  type PromoCustomer,
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
  /** What this line is charged at. Zero for a giveaway, which is every
   *  campaign the shop has run so far — but a reward can also be a percentage
   *  off or a fixed price, and then the shopper pays something for it. */
  price: number;
  /** Which promo granted it, so a refund or a question has something to read,
   *  and so the Shopify order can be tagged with it. Two promos landing on the
   *  same gift merge into one line and keep both slugs, comma-separated. */
  promoSlug: string;
};

/**
 * What one reward is charged at.
 *
 * A percentage needs a retail price to be a percentage of. When the shelf
 * could not be read the price is unknown, and null is the honest answer:
 * charging zero would give away a product meant to be sold at a discount, and
 * the cart and the order have to agree on the figure either way.
 *
 * Shared with the cart, which shows the shopper this number before they pay
 * it — two implementations of this would be two different prices.
 */
export function rewardPrice(
  retail: number | null | undefined,
  type: "free" | "percentage" | "fixed" | undefined,
  value: number | undefined,
): number | null {
  if (!type || type === "free") return 0;
  if (typeof retail !== "number" || !Number.isFinite(retail)) return null;
  if (type === "fixed") return Math.max(0, Math.min(value ?? 0, retail));
  const off = Math.min(Math.max(value ?? 0, 0), 100);
  return Math.max(0, Math.round(retail * (1 - off / 100)));
}

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
  /** What each reward sells for, by variant id. Only consulted when a reward
   *  is priced rather than given away. */
  retailOf: (variantId: string) => number | undefined = () => undefined,
  /** Which rewards the shopper picked, by promo slug, for campaigns that let
   *  them choose. Nothing is granted from those campaigns until they do. */
  chosen: Map<string, string[]> = new Map(),
  /** Who is checking out, for campaigns aimed at a tier or a first order. */
  customer?: PromoCustomer,
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
  // A milestone can also be capped: the app's "gift limitation" hands over at
  // most N of the things listed. Without it a tier listing four always gives
  // four, which is a different campaign.
  /**
   * What one reward is charged at.
   *
   * A percentage needs a retail price to be a percentage of. When the shelf
   * could not be read the price is unknown, and the honest answer is to leave
   * the reward off the order rather than guess: charging zero gives away a
   * product that was meant to be sold at a discount, and the cart showed the
   * shopper a figure we would not be honouring either way.
   */
  const priceFor = (
    variantId: string,
    item: { price?: number | null },
    type: "free" | "percentage" | "fixed" | undefined,
    value: number | undefined,
  ): number | null => rewardPrice(item.price ?? retailOf(variantId), type, value);

  const take = (
    out: CheckoutGiftLine[],
    source: Parameters<typeof giftsOf>[0] & {
      discountType?: "free" | "percentage" | "fixed";
      discountValue?: number;
    },
    promo: FreeGiftPromo,
    promoSlug: string,
    limit?: number,
  ) => {
    const items = giftsOf(source);
    // A campaign the shopper chooses from grants only what they picked, and
    // nothing at all until they pick.
    const picks = promo.giftChoice === "customer" ? (chosen.get(promo.slug) ?? []) : null;
    const wanted = picks ? items.filter((i) => picks.includes(variantFor(i) ?? "")) : items;
    const allowed = typeof limit === "number" && limit > 0 ? wanted.slice(0, limit) : wanted;
    // A tier prices its own reward; otherwise the campaign does.
    const type = source.discountType ?? promo.discountType;
    const value = source.discountValue ?? promo.discountValue;
    for (const item of allowed) {
      const variantId = variantFor(item);
      if (!variantId || !inStock(variantId)) continue;
      const price = priceFor(variantId, item, type, value);
      if (price === null) continue;
      out.push({ variantId, quantity: item.qty, price, promoSlug });
    }
  };

  const out: CheckoutGiftLine[] = [];
  for (const evaluated of evaluateActiveFreeGifts(promos, lines, customer)) {
    if (!evaluated.eligible) continue;
    const { promo, unlockedTiers } = evaluated;

    if (unlockedTiers?.length) {
      for (const tier of unlockedTiers) {
        take(out, tier, promo, `${promo.slug}::tier-${tier.tierIndex}`, promo.maxGifts);
      }
      continue;
    }

    take(out, promo, promo, promo.slug, promo.maxGifts);
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
    // Keyed on the slug, not on costing nothing: a reward at 30% off is still
    // this campaign's doing, and tagging only the free ones would undercount
    // every campaign that discounts rather than gives away.
    if (!line.promoSlug) continue;
    for (const slug of line.promoSlug.split(",")) {
      const promo = slug.split("::")[0].trim();
      if (promo) slugs.add(promo);
    }
  }
  if (slugs.size === 0) return [];
  return ["free-gift", ...[...slugs].sort().map((s) => `free-gift:${s}`)];
}

import { giftsOf, type FreeGiftItem } from "../data/free-gifts.ts";

// What a promo visibly hands over: a picture and a name per gift.
//
// Every widget was answering this for itself, and each one answered it with
// `giftProductSlug` alone — the field the promos actually running this month
// leave empty, because they list their gifts instead. So the promo cards drew
// grey rectangles, the ladder printed an empty string where a product name
// should be, and the shopper was told they had won something unnamed and
// unphotographed. The data was there the whole way; nothing asked for it.
//
// One place asks now. Widgets render what comes back and stop guessing.

/** A gift as a shopper should see it. */
export type GiftFace = {
  /** Stable enough to use as a React key within one promo. */
  key: string;
  /** Undefined only when the shelf has never heard of this variant. */
  title?: string;
  image?: string | null;
  qty: number;
  /** The shop has run out. Null stock means we could not ask Shopify, which
   *  is not the same as none left — see the API route. */
  soldOut: boolean;
};

/** The shelf names every gift "[Free Gift] …" so staff can find them in
 *  Shopify. Nobody being handed one needs telling it is free twice. */
export function giftLabel(title?: string): string | undefined {
  return title?.replace(/^\s*(TEST\s*\|\s*)?\[Free Gift\]\s*/i, "").trim() || undefined;
}

type Catalogued = { name: string; image: string } | undefined;

/**
 * The gifts attached to a promo or to one of its tiers.
 *
 * `giftsOf` already carries the name and picture the API looked up on
 * Shopify, for both the list shape and the older single-gift columns. The
 * catalogue is the second answer, for a gift written as a product slug —
 * that one is a normal shop product and has a picture of its own.
 */
export function giftFaces(
  source: Parameters<typeof giftsOf>[0],
  productBySlug?: (slug: string) => Catalogued,
): GiftFace[] {
  return giftsOf(source).map((item: FreeGiftItem, i) => {
    const fromCatalogue = item.productSlug && productBySlug ? productBySlug(item.productSlug) : undefined;
    return {
      key: item.variantId ?? item.productSlug ?? String(i),
      title: giftLabel(item.title) ?? fromCatalogue?.name,
      image: item.image ?? fromCatalogue?.image ?? null,
      qty: item.qty,
      soldOut: typeof item.stock === "number" && item.stock <= 0,
    };
  });
}

/**
 * The gifts still worth advertising.
 *
 * A promo survives on the storefront as long as one of its gifts is on the
 * shelf, which is right — but every widget then drew all of them, sold out or
 * not. Seen on the live site: the deal card offered Smooth E PHA-AHA SPOT &
 * PORE at stock 0, which the cart already refuses to add and the checkout
 * already drops. Promising it is the same mistake the cart was fixed for,
 * one screen earlier.
 */
export function availableGiftFaces(
  source: Parameters<typeof giftsOf>[0],
  productBySlug?: (slug: string) => Catalogued,
): GiftFace[] {
  return giftFaces(source, productBySlug).filter((f) => !f.soldOut);
}

/** The one gift worth putting on a card that only has room for one. A gift
 *  with a picture beats one without: the picture is the reason the card is
 *  worth looking at. */
export function leadGiftFace(
  source: Parameters<typeof giftsOf>[0],
  productBySlug?: (slug: string) => Catalogued,
): GiftFace | undefined {
  const faces = giftFaces(source, productBySlug);
  const live = faces.filter((f) => !f.soldOut);
  return live.find((f) => f.image) ?? live[0] ?? faces.find((f) => f.image) ?? faces[0];
}

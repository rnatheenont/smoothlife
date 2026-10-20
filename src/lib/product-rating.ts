/**
 * Which star rating a product shows, and which one its structured data claims.
 *
 * There are two sets of reviews and they are not the same reviews. The shop
 * has collected them on smoothlife.com through Judge.me for years — that is
 * the 4.8 from 342 people on the vitamin C — and it reaches us as the
 * standard `reviews.rating` / `reviews.rating_count` metafields, already on
 * every product in the catalogue. This site then started collecting its own,
 * which live in Supabase and number five in total.
 *
 * The product page used to prefer its own: any review written here replaced
 * the store's score outright. So a product with two reviews here showed 5.0
 * from 2 on the page, 4.8 from 342 on the card that led to it, and 4.8 from
 * 342 on www.smoothlife.com — three numbers for one product, and the
 * structured data copied the odd one out. Google checks the rating in the
 * markup against the rating on the page, and a page that disagrees with
 * itself is the thing it is checking for.
 *
 * So the store's score wins when there is one. It is the same number the
 * card showed, the same number the Shopify storefront shows, and it is drawn
 * from hundreds of people rather than two. This site's own reviews are still
 * printed in full underneath — they are worth reading — they just do not
 * replace the headline.
 *
 * One function, used by the page and by the JSON-LD, because the whole point
 * is that those two cannot drift apart.
 */

export type Rating = { value: number; count: number };

export function headlineRating(
  /** The store-wide score from Judge.me, as the catalogue carries it. */
  product: { rating?: number | null; reviewCount?: number | null },
  /** Reviews written on this site. */
  ownReviews: { rating: number }[],
): Rating | null {
  const count = product.reviewCount ?? 0;
  const value = product.rating ?? 0;
  if (count > 0 && value > 0) return { value, count };

  // Nothing from the store: a product too new to have been reviewed there, or
  // one this site sells and that one does not. Then our own reviews are the
  // only ones there are, and showing them beats showing no rating at all.
  if (ownReviews.length === 0) return null;
  const avg = ownReviews.reduce((sum, r) => sum + r.rating, 0) / ownReviews.length;
  return { value: Math.round(avg * 10) / 10, count: ownReviews.length };
}

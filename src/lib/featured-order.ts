// What "แนะนำ" means.
//
// Its own module, with no catalogue import, so the rule can be read and
// tested on its own — filter-products.ts pulls in all 900-odd products, which
// makes a unit test of the ordering impossible there.

/** Everything the order looks at, and nothing else. */
export type Rankable = {
  brand: string;
  price: number;
  compareAtPrice?: number;
  badges?: string[];
  /** Opens in the last 30 days. See Product.views. */
  views?: number;
  /** Units sold, all time. See Product.sold. */
  sold?: number;
};

// The "แนะนำ" (recommended) default previously fell straight through to raw
// catalogue order, which is alphabetical by title (scripts/fetch-products.js
// queries sortKey: TITLE) — so every category opened on a monotonous wall of
// one brand's near-identical bottles in A-Z order. It then re-ranked on
// badges and discount depth, which fixed the wall but still only expressed
// the shop's own opinion of what mattered.
//
// What customers think now leads instead: `views` is how many times a product
// was opened in the last 30 days, and `sold` is how many were bought. Both
// are real counts; see TrackProductView and fetchUnitsSold.
//
// Two groups, because the two signals are not the same kind of thing.
// Products people have actually opened go first, in plain score order — when
// demand has been measured, that measurement is the answer and shuffling it
// would be throwing the answer away. Everything else keeps the brand
// round-robin, because without a demand signal there is nothing to order the
// tail by except the shop's own badges, and a wall of one brand is the
// failure mode that round-robin exists to prevent.
//
// Both counts are long-tailed — one hero product can outsell the median by a
// hundred times — so they go in through log1p, normalised against the top of
// whatever is being ranked. Linear would hand an entire category page to a
// single product line. Normalising against the page rather than the whole
// catalogue is deliberate too: a filtered view should lead with the most
// wanted thing *in that view*.
export function toFeaturedOrder<T extends Rankable>(items: T[]): T[] {
  // reduce, not Math.max(...spread): this runs over the whole catalogue on an
  // unfiltered /shop, and a spread that size is an argument list.
  const top = (pick: (p: T) => number) => items.reduce((m, p) => Math.max(m, pick(p)), 0);
  const maxViews = top((p) => p.views ?? 0);
  const maxSold = top((p) => p.sold ?? 0);
  const share = (n: number, max: number) => (max > 0 ? Math.log1p(n) / Math.log1p(max) : 0);

  const featuredScore = (p: T) => {
    // Opens outweigh sales: they are the last thirty days rather than all
    // time, and "ขายดี" is already its own sort for anyone who wants the
    // other question answered.
    let score = 3 * share(p.views ?? 0, maxViews) + 1.5 * share(p.sold ?? 0, maxSold);
    if (p.badges?.includes("New")) score += 2;
    if (p.badges?.includes("Sale") && p.compareAtPrice) {
      score += 1 + (p.compareAtPrice - p.price) / p.compareAtPrice;
    }
    return score;
  };

  const byScore = [...items].sort((a, b) => featuredScore(b) - featuredScore(a));
  const viewed = byScore.filter((p) => (p.views ?? 0) > 0);
  const rest = byScore.filter((p) => !((p.views ?? 0) > 0));

  const brandOrder: string[] = [];
  const byBrand = new Map<string, T[]>();
  for (const p of rest) {
    if (!byBrand.has(p.brand)) {
      byBrand.set(p.brand, []);
      brandOrder.push(p.brand);
    }
    byBrand.get(p.brand)!.push(p);
  }

  const result: T[] = [...viewed];
  let remaining = rest.length;
  while (remaining > 0) {
    for (const brand of brandOrder) {
      const group = byBrand.get(brand)!;
      const next = group.shift();
      if (next) {
        result.push(next);
        remaining--;
      }
    }
  }
  return result;
}


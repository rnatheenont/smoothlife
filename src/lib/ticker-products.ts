import { products } from "@/data/products";

// What the strip across the top of every page shows.
//
// It used to carry three marketing claims on a loop. Those claims have a
// home already — the trust strip on the home page says the same three with
// links behind them — so the most valuable thing the shop can put in the one
// band that is on every page is the shop: real products, at real prices,
// one tap from the page they are on.
//
// Prepared on the server and handed to the header as a prop. The catalogue is
// 600-odd products and the header is a client component; importing products
// there would put the whole thing in the browser bundle to show fourteen.

export type TickerProduct = {
  slug: string;
  name: string;
  price: number;
  image: string;
};

const COUNT = 14;
/** At most this many from any one vendor. Ranked purely by sales, the strip
 *  came out as eight sizes of the same Dettol multipack: true, and useless
 *  as a look at what the shop sells. */
const PER_BRAND = 2;

export function tickerProducts(): TickerProduct[] {
  const sellable = products.filter((p) => p.inStock && p.image);
  // Best-sellers first because they are the ones worth interrupting someone
  // with, then the rest by units sold so the strip is full even on a
  // catalogue sync where nothing carries the badge.
  const ranked = [
    ...sellable.filter((p) => p.badges?.includes("Bestseller")),
    ...sellable
      .filter((p) => !p.badges?.includes("Bestseller"))
      .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)),
  ];
  const perBrand = new Map<string, number>();
  const picked = [];
  for (const p of ranked) {
    const seen = perBrand.get(p.brand) ?? 0;
    if (seen >= PER_BRAND) continue;
    perBrand.set(p.brand, seen + 1);
    picked.push(p);
    if (picked.length === COUNT) break;
  }
  return picked.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.price,
    image: p.image,
  }));
}

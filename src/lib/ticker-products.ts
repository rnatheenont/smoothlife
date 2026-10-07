import { products } from "@/data/products";
import { getCollectionByHandle, getCollectionProducts } from "@/data/collections";
import { SALE_COLLECTION } from "@/lib/sale-destination";

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
  /** Only set when there is a real saving to show beside the price. */
  compareAtPrice?: number;
  image: string;
};

const COUNT = 14;
/** At most this many from any one vendor. Ranked purely by sales, the strip
 *  came out as eight sizes of the same Dettol multipack: true, and useless
 *  as a look at what the shop sells. */
const PER_BRAND = 2;

export function tickerProducts(): TickerProduct[] {
  // The strip sits behind a Sale tag, so everything that scrolls past it has
  // to be genuinely marked down — nothing here is in the list without a
  // compare-at price above what it actually costs.
  //
  // The merchandisers' own sale collection leads, but it cannot fill the
  // strip on its own: of its 75 products only about a dozen are in stock
  // with a price to compare against, and capping brands then cuts that to
  // half a strip of the same two vendors. So the rest of the catalogue's
  // real markdowns follow it rather than replacing it.
  const collection = getCollectionByHandle(SALE_COLLECTION);
  const discounted = (list: typeof products) =>
    list
      .filter((p) => p.inStock && p.image && p.compareAtPrice && p.compareAtPrice > p.price)
      .sort((a, b) => b.compareAtPrice! / b.price - a.compareAtPrice! / a.price);

  const fromCollection = discounted(collection ? getCollectionProducts(collection) : []);
  const inCollection = new Set(fromCollection.map((p) => p.slug));
  // Deepest discount first within each group: there is room for fourteen, and
  // the ones worth stopping for are the ones saving the most.
  const ranked = [...fromCollection, ...discounted(products).filter((p) => !inCollection.has(p.slug))];
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
    compareAtPrice: p.compareAtPrice,
    image: p.image,
  }));
}

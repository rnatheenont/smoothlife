import { brands, brandProducts } from "@/data/brands";
import { products } from "@/data/products";
import { toCardData, type ProductCardData } from "@/data/card";

// What to put under a blog post, when nothing in the data says.
//
// The posts come from Shopify's blog feed and carry a title, an excerpt and a
// body — no tags, no product references, nothing linking them to the
// catalogue. So the link is read out of the writing: a post about a brand
// almost always names it, and naming it is a good enough reason to show what
// that brand sells.
//
// Deliberately conservative, because a shelf of products that have nothing to
// do with what somebody is reading is worse than no shelf:
//
//  - names under four characters are skipped (SOS, Mega) — they turn up
//    inside ordinary words;
//  - an ASCII name has to sit on word boundaries, so "Swisse" does not match
//    "Swisserland" and "CeraVe" does not match "CeraVera";
//  - whichever brand is named most often wins, and if none is named at all
//    the answer is an empty list, which the caller shows as nothing.

const MIN_NAME = 4;

/** Latin names need boundaries; Thai is written without spaces, so a Thai
 *  alias is matched as a plain substring. */
function countMentions(haystack: string, name: string): number {
  const needle = name.toLowerCase();
  if (!/^[\x20-\x7e]+$/.test(name)) {
    let n = 0;
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) return n;
      n += 1;
      from = at + needle.length;
    }
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return haystack.match(new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "g"))?.length ?? 0;
}

/** Slugs of what the brand this article talks about sells, or nothing. */
export function articleProductSlugs(text: string, limit: number): string[] {
  const haystack = text.toLowerCase();

  let best: { brand: (typeof brands)[number]; score: number } | null = null;
  for (const brand of brands) {
    const names = [brand.name, ...(brand.vendorAliases ?? [])].filter((n) => n.length >= MIN_NAME);
    const score = names.reduce((n, name) => n + countMentions(haystack, name), 0);
    // Ties go to the longer name: "Smooth Life" over "Smooth E" in a post
    // that happens to say both the same number of times.
    if (score > 0 && (!best || score > best.score || (score === best.score && brand.name.length > best.brand.name.length))) {
      best = { brand, score };
    }
  }
  if (!best) return [];

  return brandProducts(best.brand)
    .filter((p) => p.inStock && p.image)
    .slice(0, limit)
    .map((p) => p.slug);
}

/**
 * Cards for a list of slugs, in the catalogue's order.
 *
 * The shelves under the article arc and the "recently viewed" row are both
 * a list of slugs that somebody then has to turn into cards; doing it in the
 * browser is what an import of the catalogue buys, and doing it here costs
 * nothing.
 */
export function cardsForSlugs(slugs: readonly string[]): ProductCardData[] {
  if (slugs.length === 0) return [];
  const wanted = new Set(slugs);
  return products.filter((p) => wanted.has(p.slug)).map(toCardData);
}


/**
 * The shelves under the concern carousel, one per concern.
 *
 * Here rather than in the carousel for the same reason as everything else in
 * this file: picking ten products out of a thousand is a server's job, and
 * doing it in the component is what put the thousand in the browser.
 */
export function concernShelves(limit: number, only?: readonly string[]): Record<string, ProductCardData[]> {
  const byConcern: Record<string, ProductCardData[]> = {};
  const wanted = only ? new Set(only) : null;
  for (const p of products) {
    if (!p.inStock || !p.image) continue;
    for (const c of p.concerns) {
      if (wanted && !wanted.has(c)) continue;
      const shelf = (byConcern[c] ??= []);
      if (shelf.length < limit) shelf.push(toCardData(p));
    }
  }
  return byConcern;
}

/**
 * What each of these brands sells, as cards — the shelf under the brand
 * circles. Same reason as concernShelves: chosen on the server.
 */
export function brandShelves(slugs: readonly string[], limit: number): Record<string, ProductCardData[]> {
  const shelves: Record<string, ProductCardData[]> = {};
  for (const slug of slugs) {
    const brand = brands.find((b) => b.slug === slug);
    if (!brand) continue;
    shelves[slug] = brandProducts(brand)
      .filter((p) => p.inStock && p.image)
      .slice(0, limit)
      .map(toCardData);
  }
  return shelves;
}

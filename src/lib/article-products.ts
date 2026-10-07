import { brands, brandProducts } from "@/data/brands";

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

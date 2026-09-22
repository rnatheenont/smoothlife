import { products } from "@/data/products";
import type { Product } from "@/data/types";

// Which product page Google should treat as the real one.
//
// The shop sells the same item at several counts: a Dettol spray on its own,
// and again as "(Pack 12)"; Opti-Free 300 ml, and again as Pack 6 and Pack
// 12. Those pages carry the merchant's identical description, so to a search
// engine they are one page published three times — and three near-identical
// pages split whatever authority the product has between them instead of
// pooling it on one.
//
// A canonical fixes that without hiding anything: all three stay reachable
// and buyable, and Google is told which one to rank.
//
// Two things this deliberately does NOT do:
//
//   - Colour and size families are left alone. Nineteen Janeke brushes share
//     one description because the merchant wrote it once, but someone
//     searching "Janeke สีชมพู" wants the pink one — collapsing them would
//     retire eighteen pages that can each answer a different search.
//   - A bundle is not a pack. "Deal Duo … & Sukkiri Love Mint" or a
//     buy-one-get-one with a different freebie is a different offer, not a
//     multiple of one product, so it keeps its own page.

/** "Twelve of item X" — the same content as item X. */
const QUANTITY = /(\[|\()\s*(pack|แพ็ค|แพค)\s*\d+|\bpack\s*\d+\b|แพ็ค\s*\d+|แพ็คสุดคุ้ม\s*\d*|ยกกล่อง|\[box\]/i;

/** A different offer, even when the description was copied from a component. */
const BUNDLE =
  /buy\s*\d+\s*(get|free)|\d+\s*free\s*\d+|ซื้อ\s*\d+\s*(ฟรี|แถม)|\d+\s*แถม\s*\d+|ฟรี!|duo deal|deal duo|เซทสุดคุ้ม|เซ็ตสุดคุ้ม/i;

/** The merchant's own copy, normalised enough that two pastes of it match. */
function descriptionKey(p: Product) {
  return (p.description || p.shortDesc || "").trim().replace(/\s+/g, " ").slice(0, 140);
}

/**
 * pack slug -> base slug, built once from the catalogue.
 *
 * A group only produces a mapping when exactly one member is neither a pack
 * nor a bundle: that one is unambiguously the product itself. No plain member
 * (packs only) or several (a colour family) means there is nothing to point
 * at, or nothing that should be pointed away from — either way the group is
 * left as it is rather than guessed at.
 */
function buildMap(): Map<string, string> {
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = descriptionKey(p);
    // Short copy ("Beauty", a registration number) says nothing about whether
    // two products are the same thing.
    if (key.length < 25) continue;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }

  const map = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const plain = group.filter((p) => !QUANTITY.test(p.name) && !BUNDLE.test(p.name));
    if (plain.length !== 1) continue;
    const packs = group.filter((p) => QUANTITY.test(p.name) && !BUNDLE.test(p.name));
    for (const pack of packs) map.set(pack.slug, plain[0].slug);
  }
  return map;
}

let cached: Map<string, string> | null = null;

/** The slug whose page represents this one — itself, for all but the packs. */
export function canonicalSlugFor(slug: string): string {
  cached ??= buildMap();
  return cached.get(slug) ?? slug;
}

/** Every pack -> base pair, for the sitemap and for anyone checking the work. */
export function canonicalPairs(): [string, string][] {
  cached ??= buildMap();
  return [...cached.entries()];
}

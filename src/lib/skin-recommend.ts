// Skin Coach product picks, from the reviewed classification of every
// catalogue product (src/data/skin-product-classes.json, made by
// scripts/classify-skin-products.ts) rather than keyword hits in names.
//
// Rules, so the same result always gives the same picks:
// - Only face skincare. Body, lip, hair, oral care, supplements and devices
//   never appear, whatever their names say.
// - A product qualifies for a concern only when that concern is one of its
//   MAIN purposes; "also helps" products fill in only when there aren't
//   enough main ones.
// - A product marked unsuitable for a skin type the person named is left out.
// - Ties break on sales, then on the product's slug — no randomness.
// - Leave-on products lead; cleansers lead only for acne, oil and pores.
// - Picks are spread across product types (a cleanser, a serum, a cream)
//   before repeating a type, and a single and its multipack count once.

import type { Product } from "@/data/types";
import { products } from "@/data/products";
import classesJson from "@/data/skin-product-classes.json";
import type { ConcernMetric } from "@/lib/skin-analysis";
import type { SkinTypeKey } from "@/lib/skin-coach";

type ProductClass = {
  hash: string;
  type: string;
  face: boolean;
  primary: ConcernMetric[];
  secondary: ConcernMetric[];
  suits: SkinTypeKey[];
  avoid: SkinTypeKey[];
};
const CLASSES = classesJson as unknown as Record<string, ProductClass>;

export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  cleanser: "ล้างหน้า",
  makeup_remover: "คลีนซิ่ง",
  toner: "โทนเนอร์",
  exfoliant: "ผลัดเซลล์",
  serum: "เซรั่ม",
  moisturizer: "ครีมบำรุง",
  sunscreen: "กันแดด",
  spot_treatment: "แต้มเฉพาะจุด",
  mask: "มาส์ก",
  eye_care: "รอบดวงตา",
  set: "เซ็ต",
};

const EYE_CONCERNS: ConcernMetric[] = ["darkCircles", "eyeBags"];

// What does the work for a concern is usually left on the skin — a serum, a
// cream, a sunscreen — so those lead. Washing off counts for oily, acne-prone
// skin and pores; a makeup remover is rarely the answer to anything.
const LEAVE_ON = ["serum", "spot_treatment", "moisturizer", "eye_care", "sunscreen", "exfoliant", "mask"];
const CLEANSING_HELPS: ConcernMetric[] = ["acne", "oiliness", "pores"];
function typeWeight(type: string, concern: ConcernMetric) {
  if (LEAVE_ON.includes(type)) return 12;
  if (type === "cleanser" || type === "toner") return CLEANSING_HELPS.includes(concern) ? 10 : 2;
  if (type === "set") return -6; // a single product is the clearer advice
  return 0;
}

// Multipacks and "buy 1 get 1" listings are the same product at a promotion;
// the single reads as advice, the bundle as a sale.
const PROMO = /\[[^\]]*(free|pack|buy|get)[^\]]*\]|\([^)]*(deal|free|pack)[^)]*\)|\bpack\s*\d|buy\s*\d\s*get|แพ็ค|แถม/i;

// A product line without its size, pack or Thai subtitle: "CERAVE Foaming
// Cleanser 88ml" and "CERAVE Foaming Cleanser 473ml" are one line.
function lineOf(name: string) {
  return name
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, " ")
    .replace(/[\u0E00-\u0E7F]+/g, " ")
    .replace(/\bpack\s*\d+|\bx\s*\d+|\d+(\.\d+)?\s*(ml|g|oz|s\/bx|ชิ้น)\b\.?/g, " ")
    .replace(/is(e|ing|er)\b/g, "iz$1") // moisturising / moisturizing
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function sameLine(lines: Set<string>, name: string) {
  const l = lineOf(name);
  return Array.from(lines).some((x) => x === l || x.startsWith(`${l} `) || l.startsWith(`${x} `));
}

export type Pick = { product: Product; type: string; main: boolean };

/**
 * Up to `max` products for one concern. `exclude` holds slugs already shown
 * or already bought; `skinTypes` is what the person said about their skin.
 */
export function recommendFor(
  concern: ConcernMetric,
  { max = 3, exclude, skinTypes = [] }: { max?: number; exclude?: ReadonlySet<string>; skinTypes?: readonly SkinTypeKey[] } = {}
): Pick[] {
  const ranked: { p: Product; c: ProductClass; score: number; main: boolean }[] = [];
  for (const p of products) {
    const c = CLASSES[p.slug];
    if (!c || !c.face || !p.inStock || exclude?.has(p.slug)) continue;
    if (skinTypes.some((t) => c.avoid.includes(t))) continue;
    const main = c.primary.includes(concern);
    const also = c.secondary.includes(concern);
    if (!main && !also) continue;
    let score = main ? 100 : 40;
    if (main && c.primary.length === 1) score += 10; // made for just this
    if (EYE_CONCERNS.includes(concern)) score += c.type === "eye_care" ? 30 : -30;
    if (skinTypes.some((t) => c.suits.includes(t))) score += 8;
    score += typeWeight(c.type, concern);
    if (PROMO.test(p.name)) score -= 8;
    score += Math.min(3, Math.log10((p.sold ?? 0) + 1)) * 3 + (p.badges?.includes("Bestseller") ? 2 : 0);
    ranked.push({ p, c, score, main });
  }
  ranked.sort((a, b) => b.score - a.score || a.p.slug.localeCompare(b.p.slug));

  // Main-purpose products first; "also helps" only to fill.
  const pool = [...ranked.filter((r) => r.main), ...ranked.filter((r) => !r.main)];
  const lines = new Set<string>();
  const types = new Set<string>();
  const out: Pick[] = [];
  const take = (r: (typeof pool)[number]) => {
    lines.add(lineOf(r.p.name));
    types.add(r.c.type);
    out.push({ product: r.p, type: r.c.type, main: r.main });
  };
  // Pass 1: one per product type, main purposes and types that lead only.
  for (const r of pool) {
    if (out.length === max) break;
    if (!r.main || typeWeight(r.c.type, concern) < 10 || types.has(r.c.type) || sameLine(lines, r.p.name)) continue;
    take(r);
  }
  // Pass 2: fill, still skipping repeats of the same product line.
  for (const r of pool) {
    if (out.length === max) break;
    if (out.some((o) => o.product.slug === r.p.slug) || sameLine(lines, r.p.name)) continue;
    take(r);
  }
  return out;
}

/** How many of a concern's usual picks were left out because they were bought before. */
export function boughtCountFor(concern: ConcernMetric, bought: ReadonlySet<string>, max = 3) {
  return recommendFor(concern, { max }).filter((r) => bought.has(r.product.slug)).length;
}

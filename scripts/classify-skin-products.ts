/**
 * Classifies every catalogue product once for Skin Coach recommendations:
 * what kind of product it is, whether it goes on the face, which of the
 * twelve scan concerns it mainly (and secondarily) treats, and which skin
 * types it suits or should avoid.
 *
 * Keyword matching over names and descriptions put a capsule supplement
 * under wrinkles, a tummy butter under dryness and lip balms under sensitive
 * skin. A reading of each product by a model, validated against fixed
 * lists and saved to a file, gives the same answer every time and can be
 * reviewed by a person.
 *
 * Only products that are new, or whose name/description changed since the
 * last run, are sent — re-running is cheap.
 *
 *   npx tsx scripts/classify-skin-products.ts          # new/changed only
 *   npx tsx scripts/classify-skin-products.ts --all    # everything again
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { products } from "../src/data/products";

const OUT = path.join(__dirname, "..", "src", "data", "skin-product-classes.json");
const MODEL = "claude-opus-5";
const BATCH = 20;
const CONCURRENCY = 4;

export const PRODUCT_TYPES = [
  "cleanser", "makeup_remover", "toner", "exfoliant", "serum", "moisturizer", "sunscreen",
  "spot_treatment", "mask", "eye_care", "set", "lip", "body", "hair", "oral", "supplement", "other",
] as const;
export const SKIN_CONCERNS = [
  "acne", "spots", "wrinkles", "texture", "pores", "darkCircles", "eyeBags",
  "redness", "oiliness", "moisture", "radiance", "firmness",
] as const;
export const SKIN_TYPES = ["oily", "dry", "combination", "normal", "sensitive"] as const;

type Classified = {
  hash: string;
  type: (typeof PRODUCT_TYPES)[number];
  face: boolean;
  primary: (typeof SKIN_CONCERNS)[number][];
  secondary: (typeof SKIN_CONCERNS)[number][];
  suits: (typeof SKIN_TYPES)[number][];
  avoid: (typeof SKIN_TYPES)[number][];
};

function envKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const m = env.match(/^ANTHROPIC_API_KEY=(.*)$/m);
  if (!m) throw new Error("ANTHROPIC_API_KEY not found");
  return m[1].trim().replace(/^"|"$/g, "");
}

const hashOf = (p: (typeof products)[number]) =>
  crypto.createHash("sha1").update(`${p.name}|${p.shortDesc}|${(p.benefits || []).join("|")}`).digest("hex").slice(0, 12);

const SYSTEM = `You classify products from a Thai beauty retailer's catalogue for a skin-analysis tool that recommends FACE skincare for problems seen in a face scan. Be strict and literal: judge from the product's name and description what it actually is and what it is mainly for.

For each product return:
- type: one of ${PRODUCT_TYPES.join(", ")}.
  "set" = a bundle of several items. "eye_care" = eye cream/serum/patch for the under-eye area. "lip" = lip balm/lip care. "body" = body lotion/cream/wash, hand/foot, stretch-mark, intimate care. "hair", "oral" (toothpaste, mouthwash, breath spray), "supplement" (capsules, tablets, powders, drinks, collagen/vitamin/gummy — anything swallowed). "other" = medical dressings, devices, fragrance, anything else.
- face: true only if it is applied to the FACE skin as skincare (cleanser, toner, serum, moisturizer, sunscreen, spot treatment, mask, eye care, makeup remover, exfoliant, or a set of these). Body, lip, hair, oral, supplement, devices → false.
- primary: the 1-2 scan concerns this product is MAINLY made for (empty if not face skincare).
- secondary: up to 3 further concerns it clearly also helps (never repeats primary).
  Concerns: acne (breakouts), spots (dark spots, melasma, post-acne marks, uneven tone), wrinkles (fine lines/wrinkles), texture (rough/uneven surface), pores (enlarged pores), darkCircles (dark under-eye), eyeBags (under-eye puffiness), redness (redness/irritation/sensitive-skin soothing), oiliness (excess oil/shine), moisture (dryness/dehydration), radiance (dullness, brightening/glow), firmness (sagging, loss of elasticity).
  A sunscreen's primary concern is usually "spots" (prevents dark spots) unless the name states another purpose.
- suits: skin types it is explicitly made for (${SKIN_TYPES.join(", ")}); empty if for all skin types or not stated.
- avoid: skin types it is clearly unsuitable for (e.g. strong oil-control for dry skin, strong acids/retinoids for sensitive skin); empty if none.

Output ONLY a JSON array, one object per product, in the same order, each: {"slug": string, "type": string, "face": boolean, "primary": string[], "secondary": string[], "suits": string[], "avoid": string[]}`;

function describe(p: (typeof products)[number]) {
  const body = [p.shortDesc, (p.benefits || []).join(" · "), (p.description || "").slice(0, 300)]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 700);
  return `slug: ${p.slug}\nname: ${p.name}\nbrand: ${p.brand}\nsize: ${p.size || ""}\ndetails: ${body}`;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], max: number): T[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x)))).slice(0, max);
}

async function classifyBatch(batch: (typeof products)[number][], key: string): Promise<Record<string, Omit<Classified, "hash">>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: batch.map((p, i) => `#${i + 1}\n${describe(p)}`).join("\n\n") }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("refused");
  const text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("no JSON array in reply");
  const arr = JSON.parse(match[0]) as Record<string, unknown>[];
  const out: Record<string, Omit<Classified, "hash">> = {};
  for (const item of arr) {
    const slug = typeof item.slug === "string" ? item.slug : "";
    if (!batch.some((p) => p.slug === slug)) continue;
    const type = (PRODUCT_TYPES as readonly string[]).includes(item.type as string) ? (item.type as Classified["type"]) : "other";
    const topical = !["lip", "body", "hair", "oral", "supplement", "other"].includes(type);
    const face = item.face === true && topical;
    const primary = face ? pick(item.primary, SKIN_CONCERNS, 2) : [];
    const secondary = face ? pick(item.secondary, SKIN_CONCERNS, 3).filter((c) => !primary.includes(c)) : [];
    out[slug] = { type, face, primary, secondary, suits: pick(item.suits, SKIN_TYPES, 5), avoid: pick(item.avoid, SKIN_TYPES, 5) };
  }
  return out;
}

async function main() {
  const all = process.argv.includes("--all");
  const key = envKey();
  const existing: Record<string, Classified> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const trial = process.argv.find((a) => a.startsWith("--only="));
  const only = trial ? new Set(trial.slice(7).split(",")) : null;
  const todo = products.filter((p) => (only ? only.has(p.slug) : all || existing[p.slug]?.hash !== hashOf(p)));
  console.log(`${products.length} products, ${todo.length} to classify`);

  const batches: (typeof products)[number][][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));

  let done = 0;
  let failed = 0;
  const result = { ...existing };
  const worker = async () => {
    while (batches.length) {
      const batch = batches.shift()!;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const got = await classifyBatch(batch, key);
          for (const p of batch) {
            if (got[p.slug]) result[p.slug] = { hash: hashOf(p), ...got[p.slug] };
            else failed++;
          }
          break;
        } catch (err) {
          if (attempt === 3) {
            failed += batch.length;
            console.error("batch failed:", String(err).slice(0, 200));
          } else await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }
      done += batch.length;
      process.stdout.write(`\r${done}/${todo.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Drop products no longer in the catalogue; keep keys sorted for readable diffs.
  const live = new Set(products.map((p) => p.slug));
  const sorted = Object.fromEntries(Object.entries(result).filter(([s]) => live.has(s)).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + "\n");
  console.log(`\nwrote ${Object.keys(sorted).length} classifications, ${failed} missing`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

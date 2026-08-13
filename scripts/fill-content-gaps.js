/* eslint-disable */
// One-off (re-runnable) backfill: writes AI-generated benefits/howToUse/whoFor
// copy for products whose Shopify description doesn't have a clean version of
// that field, strictly grounded in that product's own real text — never
// invents facts, and never touches `ingredients` (safety-sensitive; stays
// honestly empty when the source has no real ingredients section).
//
// Results are cached in scripts/ai-content-cache.json (committed to git) so
// normal builds (via fetch-products.js) apply it for free with zero API
// calls — this script only needs to run again when new products show up or
// an existing product's own description text changes (the cache
// self-invalidates per-product via a content hash).
//
// Usage:
//   node scripts/fetch-products.js        # refresh products.snapshot.json first
//   node scripts/fill-content-gaps.js      # fill gaps, update the cache
//   node scripts/fetch-products.js         # regenerate .ts with the cache applied
//
// Env:
//   FILL_LIMIT=20   cap how many products to process this run (default: all)

const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk");
const { sourceHash, CONTENT_CACHE, SNAPSHOT } = require("./fetch-products");

const MODEL = "claude-opus-5";
const LIMIT = process.env.FILL_LIMIT ? parseInt(process.env.FILL_LIMIT, 10) : Infinity;

const SYSTEM_PROMPT = `You write catalogue copy for a Thai health & beauty e-commerce site (Smoothlife.com), strictly grounded in the real product text you are given.

Rules:
- Never invent facts, ingredients, medical claims, or details not present in the source text. Only reorganize, summarize, and lightly rephrase what is already there.
- Write in Thai.
- Only fill the fields listed as MISSING. If the source text genuinely doesn't contain enough information for a requested field, output an empty string ("") or empty array ([]) for it — do not pad with generic filler.
- Never state or imply specific ingredients — a separate, stricter process handles that field from verified data only. Do not mention ingredient names even in passing.
- benefits: an array of short bullet points (each under ~100 characters), only drawn from the source text.
- howToUse: 1-3 short sentences on how to use the product, only if the source text actually describes usage.
- whoFor: 1-2 short sentences on who the product suits, only if the source text implies this.

Respond with ONLY a raw JSON object, no markdown fences, no explanation, e.g.:
{"benefits": ["...", "..."], "howToUse": "...", "whoFor": "..."}
Omit a key entirely if it wasn't in the MISSING list.`;

function needsFill(p) {
  const missing = [];
  if (!p.benefits || !p.benefits.length) missing.push("benefits");
  if (!p.howToUse) missing.push("howToUse");
  if (!p.whoFor) missing.push("whoFor");
  if (!missing.length) return null;
  const hasSource = (p.description && p.description.length > 10) || (p.shortDesc && p.shortDesc.length > 10);
  return hasSource ? missing : null;
}

async function fillOne(client, p, missing) {
  const userMsg = [
    `Product name: ${p.name}`,
    `Category: ${p.category}`,
    p.shortDesc ? `Short description: ${p.shortDesc}` : "",
    p.description ? `Full description: ${p.description}` : "",
    p.benefits && p.benefits.length ? `Existing benefits (keep as-is, don't repeat): ${p.benefits.join(" | ")}` : "",
    `MISSING fields to fill: ${missing.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(jsonText);
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY must be set");
  if (!fs.existsSync(SNAPSHOT)) {
    throw new Error("products.snapshot.json missing — run `node scripts/fetch-products.js` first");
  }
  const products = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));

  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CONTENT_CACHE, "utf8"));
  } catch {}

  const todo = [];
  for (const p of products) {
    const hash = sourceHash(p);
    const cached = cache[p.slug];
    if (cached && cached.sourceHash === hash) continue; // already filled & unchanged
    const missing = needsFill(p);
    if (!missing) continue; // nothing missing, or no real source text to ground on
    todo.push({ p, missing, hash });
  }

  console.log(`[fill] ${todo.length} products need filling (of ${products.length} total)`);
  const batch = todo.slice(0, LIMIT);
  if (batch.length < todo.length) {
    console.log(`[fill] FILL_LIMIT=${LIMIT} set — processing ${batch.length} this run`);
  }

  const client = new Anthropic({ apiKey: key });
  let ok = 0;
  let failed = 0;
  for (const { p, missing, hash } of batch) {
    try {
      const result = await fillOne(client, p, missing);
      cache[p.slug] = {
        sourceHash: hash,
        ...(result.benefits && result.benefits.length ? { benefits: result.benefits } : {}),
        ...(result.howToUse ? { howToUse: result.howToUse } : {}),
        ...(result.whoFor ? { whoFor: result.whoFor } : {}),
      };
      ok++;
      process.stdout.write(`  [${ok + failed}/${batch.length}] ${p.slug} ✓\n`);
    } catch (e) {
      failed++;
      process.stdout.write(`  [${ok + failed}/${batch.length}] ${p.slug} ✗ ${e.message}\n`);
    }
    // Persist incrementally so a crash partway through doesn't lose earlier work.
    fs.writeFileSync(CONTENT_CACHE, JSON.stringify(cache, null, 2), "utf8");
  }

  console.log(`[fill] done — ${ok} filled, ${failed} failed, ${todo.length - batch.length} left for next run`);
}

main().catch((e) => {
  console.error("[fill] fatal:", e.message);
  process.exit(1);
});

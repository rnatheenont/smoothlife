// Turns the Shopify product CSV export into starting spec tables.
//
// Why this exists: the team filled in Shopify's taxonomy metafields for a good
// part of the catalogue — product form, who it suits, key ingredients,
// certifications — and none of it appears anywhere on the site. Retyping it
// for 1,086 products by hand is the work this avoids. Measured on the export
// that came with it: 715 products carry at least one of these fields.
//
// What it will not do:
//   • invent a translation. A value with no entry in product-spec-vocab.mjs is
//     dropped from the row; the admin can add it by hand. Both languages or
//     neither — a Thai-only row would quietly restore the problem the whole
//     bilingual scheme exists to fix.
//   • touch a product that already has content. Somebody's draft is worth more
//     than an import.
//   • publish anything. Every row lands as a draft for a person to open.
//
//   node scripts/import-product-specs.mjs <export.csv>          # dry run
//   node scripts/import-product-specs.mjs <export.csv> --write  # apply
import { readFileSync } from "node:fs";
import {
  SPEC_LABELS,
  SPEC_VALUES,
  SPEC_VALUES_BY_LABEL,
  SPEC_COLUMN_ORDER,
} from "./product-spec-vocab.mjs";

const CSV = process.argv[2];
const WRITE = process.argv.includes("--write");
if (!CSV) {
  console.error("usage: node scripts/import-product-specs.mjs <export.csv> [--write]");
  process.exit(1);
}

function env() {
  const out = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}

/** Minimal RFC4180 reader — the export has quoted fields with commas and newlines in them. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** The catalogue as the site has it: one object per line, written by
 *  fetch-products.js. Read rather than imported because this is a plain Node
 *  script and that file is TypeScript. */
function catalogue() {
  const out = [];
  for (const line of readFileSync("src/data/products.generated.ts", "utf8").split("\n")) {
    if (!line.startsWith("{slug:")) continue;
    const slug = (line.match(/slug:"([^"]+)"/) || [])[1];
    const variantIds = [...line.matchAll(/variantId:"([^"]+)"/g)].map((m) => m[1]);
    const skus = [...line.matchAll(/sku:"([^"]+)"/g)].map((m) => m[1]);
    if (slug && variantIds.length) out.push({ slug, variantIds: [...new Set(variantIds)], skus });
  }
  return out;
}

/** Same rule as the admin screens: the lowest variant GID, which does not move
 *  when a price or a stock level does. */
function stableVariantId(variantIds) {
  const num = (id) => BigInt(id.match(/(\d+)$/)?.[1] ?? "0");
  return [...variantIds].sort((a, b) => (num(a) < num(b) ? -1 : num(a) > num(b) ? 1 : 0))[0];
}

const rows = parseCsv(readFileSync(CSV, "utf8"));
const header = rows[0];
const idx = (name) => header.findIndex((h) => h === name || h.startsWith(name + " (product.metafields."));
const H = header.indexOf("Handle");
const SKU = header.indexOf("Variant SKU");

// Shopify writes one row per variant and per image; the product-level fields
// are only on a product's first row, but its SKUs are spread over all of them.
const byHandle = new Map();
for (const r of rows.slice(1)) {
  if (r.length < 2 || !r[H]) continue;
  const e = byHandle.get(r[H]) ?? { first: r, skus: new Set() };
  if (!byHandle.has(r[H])) byHandle.set(r[H], e);
  const sku = (r[SKU] ?? "").trim();
  if (sku) e.skus.add(sku);
}

const products = catalogue();
const bySlug = new Map(products.map((p) => [p.slug, p]));
const bySku = new Map();
for (const p of products) for (const s of p.skus) if (!bySku.has(s)) bySku.set(s, p);

const columns = SPEC_COLUMN_ORDER.map((name) => ({ name, i: idx(name) })).filter((c) => c.i >= 0);

let matched = 0, unmatched = 0, noSpecs = 0, skippedValues = new Map();
const drafts = [];
for (const [handle, e] of byHandle) {
  // SKU first: a handle can be renamed, and the catalogue dedupes colliding
  // slugs with a numeric suffix, so slugs and handles are not always the same.
  let product = null;
  for (const s of e.skus) { product = bySku.get(s); if (product) break; }
  if (!product) product = bySlug.get(handle) ?? null;
  if (!product) { unmatched++; continue; }
  matched++;

  const specRows = [];
  for (const c of columns) {
    const raw = (e.first[c.i] ?? "").trim();
    if (!raw) continue;
    const labelKey = c.name.replace(/ \(product\.metafields\.[^)]+\)$/, "");
    const label = SPEC_LABELS[labelKey];
    if (!label) continue;
    // What this column makes a value mean beats the general reading — and a
    // column may say the value means nothing here, which drops it.
    const byLabel = SPEC_VALUES_BY_LABEL[labelKey];
    const parts = raw.split(";").map((s) => s.trim()).filter(Boolean);
    const resolve = (p) => (byLabel && p in byLabel ? byLabel[p] : SPEC_VALUES[p]);
    const known = parts.map(resolve).filter(Boolean);
    // A value dropped on purpose is not an unknown one, and reporting it as
    // missing vocabulary would send somebody to add it back.
    for (const p of parts)
      if (!resolve(p) && !(byLabel && p in byLabel))
        skippedValues.set(p, (skippedValues.get(p) ?? 0) + 1);
    if (known.length === 0) continue;
    specRows.push({
      labelTh: label.th,
      labelEn: label.en,
      valueTh: known.map((k) => k.th).join(" · "),
      valueEn: known.map((k) => k.en).join(" · "),
    });
  }
  if (specRows.length === 0) { noSpecs++; continue; }

  drafts.push({
    variant_id: stableVariantId(product.variantIds),
    sku: product.skus[0] ?? null,
    slug: product.slug,
    // Marked as having a source, because it does: these are the shop's own
    // records in Shopify, copied across unchanged. Nothing here was written by
    // a model, and nothing is published — a person still opens each one.
    blocks: [{ type: "spec_table", hasVerifiedSource: true, rows: specRows }],
    published: false,
  });
}

// Two Shopify handles can land on one catalogue product — the catalogue merges
// a product that was re-created under a new handle but kept its SKUs, and a
// batch carrying the same variant_id twice is rejected whole by the unique
// constraint. Keep whichever row says more.
const byVariant = new Map();
for (const d of drafts) {
  const prev = byVariant.get(d.variant_id);
  if (!prev || d.blocks[0].rows.length > prev.blocks[0].rows.length) byVariant.set(d.variant_id, d);
}
const deduped = [...byVariant.values()];
if (deduped.length !== drafts.length) {
  console.log(`two CSV handles shared one catalogue product ${drafts.length - deduped.length} time(s) — kept the fuller row`);
}
drafts.length = 0;
drafts.push(...deduped);

const skipped = [...skippedValues.entries()].sort((a, b) => b[1] - a[1]);
console.log(`CSV products: ${byHandle.size} | matched to catalogue: ${matched} | unmatched: ${unmatched}`);
console.log(`no usable specs: ${noSpecs} | drafts to write: ${drafts.length}`);
console.log(`rows per draft: min ${Math.min(...drafts.map((d) => d.blocks[0].rows.length))}, max ${Math.max(...drafts.map((d) => d.blocks[0].rows.length))}`);
console.log(`values with no translation (dropped): ${skipped.length} distinct, ${skipped.reduce((a, [, n]) => a + n, 0)} occurrences`);
if (skipped.length) console.log("  most common:", skipped.slice(0, 20).map(([v, n]) => `${v}(${n})`).join(" "));
console.log("\nexample draft:", JSON.stringify(drafts[0], null, 1).slice(0, 700));

if (!WRITE) {
  console.log("\n(dry run — pass --write to apply)");
  process.exit(0);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local to write");
  process.exit(1);
}
const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

// Anything already in the table stays untouched, draft or published.
const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/product_content_overrides?select=variant_id&limit=5000`, { headers });
const existing = new Set((await existingRes.json()).map((r) => r.variant_id));
const fresh = drafts.filter((d) => !existing.has(d.variant_id));
console.log(`\nalready has content: ${drafts.length - fresh.length} skipped | inserting: ${fresh.length}`);

for (let i = 0; i < fresh.length; i += 200) {
  const batch = fresh.slice(i, i + 200);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_content_overrides`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(batch),
  });
  if (!res.ok) { console.error("insert failed", res.status, (await res.text()).slice(0, 300)); process.exit(1); }
  console.log(`  inserted ${Math.min(i + batch.length, fresh.length)}/${fresh.length}`);
}
console.log("done");

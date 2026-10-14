#!/usr/bin/env node
// Which storefront client components drag the catalogue into the browser.
//
// The catalogue is ~650 KB of products. A "use client" component that
// imports it — directly, or through any module that does — puts all of it in
// the bundle of every page that renders the component, to show a shelf of
// ten. This walks the static import graph from every client entry and says
// which ones still do.
//
// Two lists, because they are different severities:
//   forbidden — the full catalogue and the long product text. These are
//               server-only by design, and one import is a 4 MB regression.
//               Any hit fails the build.
//   lite      — the card-sized catalogue. Being worked down to zero (see the
//               performance plan, R3); the ratchet below stops it going back
//               up while that is in progress.
//
// Run: node scripts/check-client-bundle.mjs [repo-root]

import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? process.cwd();
const src = path.join(root, "src");

/** How many client entries may reach the card-sized catalogue. It is zero,
 *  and the only honest reason to raise it is that a page genuinely cannot
 *  work any other way — in which case say which page, here. */
const LITE_BUDGET = 0;

const FORBIDDEN = /products\.generated\.ts$|product-details\.ts$/;
const LITE = /products-lite\.generated\.ts$/;

const EXTS = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

function resolve(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(src, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const e of EXTS) if (fs.existsSync(base + e)) return base + e;
  return null;
}

const depCache = new Map();
function deps(file) {
  if (depCache.has(file)) return depCache.get(file);
  const text = fs.readFileSync(file, "utf8");
  const out = [];
  // Static imports only: a dynamic import() is a separate chunk, which is
  // the whole point of writing one.
  const re = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) continue; // import type — erased at build time
    const resolved = resolve(file, m[2]);
    if (resolved) out.push(resolved);
  }
  depCache.set(file, out);
  return out;
}

const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const files = walk(src).filter((f) => /\.(tsx?|jsx?)$/.test(f));
const isClient = (f) => /^\s*['"]use client['"]/.test(fs.readFileSync(f, "utf8"));

/** The admin is the team's own tool on its own routes — it may read whatever
 *  it likes, and nobody shopping ever loads it. */
const isAdmin = (f) => f.includes("/app/admin/") || f.includes("/components/admin/");

function chainTo(entry, target) {
  const from = new Map([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (target.test(file)) {
      const chain = [];
      for (let f = file; f; f = from.get(f)) chain.unshift(path.relative(src, f));
      return chain;
    }
    for (const next of deps(file)) {
      if (!from.has(next)) {
        from.set(next, file);
        queue.push(next);
      }
    }
  }
  return null;
}

const entries = files.filter((f) => isClient(f) && !isAdmin(f));
const forbidden = [];
const lite = [];
for (const entry of entries) {
  const bad = chainTo(entry, FORBIDDEN);
  if (bad) forbidden.push(bad);
  const heavy = chainTo(entry, LITE);
  if (heavy) lite.push(heavy);
}

if (forbidden.length) {
  console.error("[client-bundle] a storefront client component reaches server-only product data:");
  for (const c of forbidden) console.error(`  ${c.join(" → ")}`);
  console.error("  Read it on the server and pass what is needed as props.");
  process.exit(1);
}

console.log(`[client-bundle] client entries reaching the card catalogue: ${lite.length} (budget ${LITE_BUDGET})`);
if (process.env.SHOW_CHAINS) for (const c of lite) console.log("  " + c.join(" → "));
if (lite.length > LITE_BUDGET) {
  console.error("[client-bundle] the catalogue is back in the browser, through:");
  for (const c of lite) console.error(`  ${c.join(" → ")}`);
  console.error(`  Either pass the data in as props, fetch it from /api/products/lite,`);
  console.error(`  or — if this really is the right call — raise LITE_BUDGET in this file.`);
  process.exit(1);
}

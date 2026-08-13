/* eslint-disable */
// Pulls the real Smooth Life catalogue from the configured Shopify store's
// Storefront API at build time and writes src/data/products.generated.ts.
// This is the *only* source of products in the app — there is no
// hand-written/demo catalogue. If the fetch fails, the build still succeeds
// but the site will simply have no products until the next successful build.
//
// Store + token are read from env vars only — never hardcode a store domain
// here. To point the site at a different Shopify store (e.g. moving from a
// sandbox to the production store), just change the env vars.

const fs = require("fs");
const path = require("path");

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const API_VERSION = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || "2025-10";
const OUT = path.join(__dirname, "..", "src", "data", "products.generated.ts");
// Working snapshot consumed by scripts/fill-content-gaps.js — not checked
// into git (see .gitignore), just a hand-off between the two scripts.
const SNAPSHOT = path.join(__dirname, "..", "src", "data", "products.snapshot.json");
// AI-written benefits/howToUse/whoFor for products whose Shopify description
// doesn't have a clean version of that field — filled in once by
// fill-content-gaps.js and committed to git so normal builds never call the
// API; only re-runs if a product's own source text actually changes.
const CONTENT_CACHE = path.join(__dirname, "ai-content-cache.json");
const PAGE_SIZE = 100;

// Cheap content fingerprint so the cache self-invalidates if a product's
// underlying Shopify text changes, without needing any extra bookkeeping.
function sourceHash(p) {
  const s = `${p.name}|${p.shortDesc}|${p.description}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function applyContentCache(products) {
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CONTENT_CACHE, "utf8"));
  } catch {
    return; // no cache yet — fine, fields just stay as scraped (possibly empty)
  }
  let applied = 0;
  for (const p of products) {
    const entry = cache[p.slug];
    if (!entry || entry.sourceHash !== sourceHash(p)) continue;
    let changed = false;
    if (!p.benefits.length && entry.benefits && entry.benefits.length) {
      p.benefits = entry.benefits;
      changed = true;
    }
    if (!p.howToUse && entry.howToUse) {
      p.howToUse = entry.howToUse;
      changed = true;
    }
    if (!p.whoFor && entry.whoFor) {
      p.whoFor = entry.whoFor;
      changed = true;
    }
    if (changed) applied++;
  }
  if (applied) console.log(`[catalogue] applied AI content cache to ${applied} products`);
}

/* ---------- text helpers ---------- */

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'");
}

function blocks(html) {
  if (!html) return [];
  // Some source content is double-encoded (e.g. "&amp;amp;") — decode twice.
  let s = decodeEntities(decodeEntities(String(html)));
  // Word-exported product descriptions routinely put a literal newline right
  // after "<li>", before the item's own text/spans. If we let the generic
  // "<li>" -> "• " + block-split pipeline run over that as-is, the "• " ends
  // up alone on its own line (which then gets filtered out for being too
  // short) while the bullet's actual text survives on the *next* line with
  // no marker at all — indistinguishable from prose, so it leaks into
  // benefits/description. Coalesce each <li>...</li> into one marked line
  // first, collapsing any internal newlines, so the marker always stays
  // attached to its text.
  s = s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => "\n• " + inner.replace(/[\r\n]+/g, " ") + "\n");
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1);
}

function clip(s, n) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

function slugify(title, id) {
  const ascii = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  const trimmed = ascii.split("-").slice(0, 9).join("-");
  return trimmed.length >= 4 ? trimmed : "sl-" + id;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- classification (same heuristics as before, run over live tags/title) ---------- */

const CATEGORY_RULES = [
  ["oral-care", ["ยาสีฟัน", "แปรงสีฟัน", "ช่องปาก", "น้ำยาบ้วนปาก", "toothpaste", "toothbrush", "mouthwash", "dentiste", "oral"]],
  ["hair-care", ["แชมพู", "ครีมนวด", "เส้นผม", "หนังศีรษะ", "ผมร่วง", "shampoo", "conditioner", "hair", "scalp"]],
  ["wellness", ["วิตามิน", "อาหารเสริม", "คอลลาเจน", "โพรไบโอ", "supplement", "vitamin", "collagen", "probiotic", "gummy", "wellness"]],
  ["body-care", ["ครีมทาผิวกาย", "โลชั่น", "ผิวกาย", "สบู่", "อาบน้ำ", "body", "lotion", "shower", "soap", "hand cream", "deodorant"]],
  ["personal-care", ["ผ้าอนามัย", "จุดซ่อนเร้น", "แผ่นแปะ", "เจลล้างมือ", "feminine", "intimate", "sanitiz", "wipes", "tissue"]],
  ["skincare", ["เซรั่ม", "ครีม", "กันแดด", "โฟม", "คลีนซิ่ง", "มาส์ก", "โทนเนอร์", "serum", "cream", "sunscreen", "cleanser", "toner", "mask", "essence", "moisturi", "spf", "facial", "skin"]],
];

const CONCERN_RULES = [
  ["acne", ["สิว", "ผิวแพ้ง่าย", "ระคายเคือง", "acne", "blemish", "sensitive", "breakout"]],
  ["dryness", ["ชุ่มชื้น", "ผิวแห้ง", "เกราะผิว", "hydrat", "dry", "barrier", "moistur", "ceramide", "hyaluron"]],
  ["dark-spots", ["จุดด่างดำ", "กระจ่างใส", "ฝ้า", "หมองคล้ำ", "ผิวขาว", "vitamin c", "brighten", "dark spot", "glutathione", "niacinamide", "whitening"]],
  ["aging", ["ริ้วรอย", "ชะลอวัย", "กระชับ", "ยกกระชับ", "anti-aging", "wrinkle", "firm", "retinol", "collagen", "lifting"]],
  ["hair-scalp", ["ผมร่วง", "หนังศีรษะ", "เส้นผม", "รังแค", "hair", "scalp", "dandruff"]],
  ["sleep-stress", ["นอนหลับ", "ผ่อนคลาย", "ความเครียด", "melatonin", "sleep", "relax", "stress", "magnesium"]],
];

function matchRules(rules, haystack, fallback) {
  const hits = [];
  for (const [key, words] of rules) {
    if (words.some((w) => haystack.includes(w))) hits.push(key);
  }
  return hits.length ? hits : fallback;
}

const SECTION_KEYS = [
  ["howToUse", ["วิธีใช้", "วิธีการใช้", "how to use", "directions"]],
  ["ingredients", ["ส่วนประกอบ", "ส่วนผสม", "ingredients"]],
  ["whoFor", ["เหมาะสำหรับ", "เหมาะกับ", "suitable for"]],
];

function sections(lines) {
  const out = { howToUse: "", ingredients: "", whoFor: "" };
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    for (const [field, keys] of SECTION_KEYS) {
      if (out[field]) continue;
      const hit = keys.find((k) => low.includes(k));
      if (!hit) continue;
      const after = lines[i].replace(/^[^:：]*[:：]\s*/, "");
      if (after && after.length > 8 && after !== lines[i]) {
        out[field] = after;
        continue;
      }
      // No usable inline content after a colon. Only treat this as a real
      // section heading — and go looking at the following lines — if the
      // keyword basically *is* the line (a short standalone label like
      // "จุดเด่น" or "Ingredients & Benefits", keyword near the start).
      // Otherwise it's just an incidental mention buried inside an
      // unrelated marketing sentence (e.g. "...ด้วยส่วนผสมจากธรรมชาติ...")
      // and grabbing "the next line" would attach a random, unrelated
      // fragment (often another section's heading) to this field.
      const idx = low.indexOf(hit);
      if (lines[i].length > 40 || idx > 6) continue;
      const collected = [];
      let j = i + 1;
      while (j < lines.length && lines[j].startsWith("• ")) {
        collected.push(lines[j].slice(2).trim());
        j++;
      }
      const next = lines[i + 1] || "";
      out[field] = collected.length ? collected.join(" ") : next.length > 15 ? next : "";
    }
  }
  return out;
}

/* ---------- Storefront API fetch ---------- */

const PRODUCTS_QUERY = `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      edges {
        cursor
        node {
          id
          title
          handle
          vendor
          productType
          tags
          descriptionHtml
          publishedAt
          images(first: 2) { edges { node { url } } }
          variants(first: 25) {
            edges {
              node {
                id
                title
                availableForSale
                price { amount }
                compareAtPrice { amount }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function storefrontFetch(query, variables) {
  const res = await fetch(`https://${DOMAIN}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchAll() {
  if (process.env.CATALOGUE_FIXTURE) {
    const fx = JSON.parse(fs.readFileSync(process.env.CATALOGUE_FIXTURE, "utf8"));
    return fx.products || fx;
  }
  if (!DOMAIN || !TOKEN) {
    throw new Error(
      "NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN must be set"
    );
  }
  const all = [];
  let after = null;
  for (let page = 1; page <= 40; page++) {
    const data = await storefrontFetch(PRODUCTS_QUERY, { first: PAGE_SIZE, after });
    const edges = data.products.edges;
    all.push(...edges.map((e) => e.node));
    process.stdout.write(`  page ${page}: ${edges.length} products\n`);
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }
  return all;
}

/* ---------- mapping ---------- */

function toProduct(p, usedSlugs) {
  const variantNodes = ((p.variants && p.variants.edges) || []).map((e) => e.node).filter(Boolean);
  if (!variantNodes.length) return null;

  const allVariants = variantNodes
    .map((v) => {
      const vPrice = Math.round(parseFloat(v.price.amount));
      if (!vPrice || vPrice <= 0) return null;
      const vCompare = v.compareAtPrice ? Math.round(parseFloat(v.compareAtPrice.amount)) : 0;
      return {
        variantId: v.id,
        size: v.title && v.title !== "Default Title" ? v.title : "",
        price: vPrice,
        compareAtPrice: vCompare > vPrice ? vCompare : 0,
        inStock: v.availableForSale !== false,
      };
    })
    .filter(Boolean);
  if (!allVariants.length) return null;

  // Default variant shown on cards / used by quick-add / chat & quiz
  // recommendations: the cheapest in-stock one, so "starting from" pricing
  // on a listing card always matches what quick-add would actually charge.
  // Falls back to the cheapest overall if every variant is out of stock.
  const inStockVariants = allVariants.filter((v) => v.inStock);
  const pool = inStockVariants.length ? inStockVariants : allVariants;
  const variant = pool.reduce((min, v) => (v.price < min.price ? v : min), pool[0]);

  const price = variant.price;
  const compare = variant.compareAtPrice || 0;

  const images = ((p.images && p.images.edges) || []).map((e) => e.node).filter((i) => i && i.url);
  if (!images.length) return null;
  const img = (i) => images[i].url + (images[i].url.includes("?") ? "&" : "?") + "width=700";

  const tags = (p.tags || []).join(" ");
  const hay = `${p.title} ${p.productType} ${tags} ${p.vendor}`.toLowerCase();

  const category = matchRules(CATEGORY_RULES, hay, ["skincare"])[0];
  const softFallback =
    category === "skincare" || category === "body-care" ? ["dryness"] : [];
  const concerns = matchRules(CONCERN_RULES, hay, softFallback).slice(0, 3);

  const lines = blocks(p.descriptionHtml);
  const sec = sections(lines);
  const claimed = new Set([sec.howToUse, sec.ingredients, sec.whoFor].filter(Boolean));
  const prose = lines.filter(
    (l) =>
      l.length > 25 &&
      !/^[•\-–]/.test(l) &&
      !claimed.has(l) &&
      !SECTION_KEYS.some(([, keys]) => keys.some((k) => l.toLowerCase().startsWith(k)))
  );

  const badges = [];
  if (compare > price) badges.push("Sale");
  if (/แพ็ค|เซ็ต|pack|set|bundle|คู่/i.test(p.title)) badges.push("Bundle");
  const created = Date.parse(p.publishedAt || 0);
  if (created && Date.now() - created < 1000 * 60 * 60 * 24 * 60) badges.push("New");

  // Shopify handles are usually clean ASCII, but merchants can set a custom
  // handle containing any script (e.g. Thai). An unsanitized handle becomes
  // a URL segment and, during static export, a filesystem path — long
  // non-ASCII text there blows past filename length limits (ENAMETOOLONG).
  // Only trust the handle if it's already a plain ascii slug; otherwise
  // derive one from the title like we do when there's no handle at all.
  const isAsciiSlug = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.handle || "");
  let slug = isAsciiSlug ? p.handle : slugify(p.title, p.id);
  slug = slug.slice(0, 80).replace(/-+$/, "");
  if (usedSlugs.has(slug)) slug = slug + "-" + p.id.replace(/\D/g, "").slice(-5);
  usedSlugs.add(slug);

  return {
    slug,
    variantId: variant.variantId,
    name: String(p.title || "").replace(/\s+/g, " ").trim(),
    brand: String(p.vendor || "Smooth Life").trim(),
    category,
    concerns,
    price,
    compareAtPrice: compare > price ? compare : 0,
    image: img(0),
    image2: images[1] ? img(1) : "",
    rating: 0,
    reviewCount: 0,
    badges: badges.slice(0, 3),
    shortDesc: clip(prose[0] || lines[0] || "", 130),
    description: clip(prose.slice(0, 4).join(" "), 900),
    benefits: (prose.length > 2
      ? prose.slice(1, 4)
      : lines.filter((l) => /^•/.test(l)).slice(0, 3).map((l) => l.replace(/^•\s*/, ""))
    ).map((b) => clip(b, 120)),
    howToUse: clip(sec.howToUse, 300),
    ingredients: clip(sec.ingredients, 600),
    whoFor: clip(sec.whoFor, 240),
    inStock: variant.inStock,
    size: variant.size,
    variants: allVariants,
  };
}

/* ---------- emit ---------- */

function serialise(list) {
  const rows = list.map((p) => {
    const f = [];
    f.push(`slug:"${esc(p.slug)}"`);
    f.push(`variantId:"${esc(p.variantId)}"`);
    f.push(`name:"${esc(p.name)}"`);
    f.push(`brand:"${esc(p.brand)}"`);
    f.push(`category:"${p.category}"`);
    f.push(`concerns:[${p.concerns.map((c) => `"${c}"`).join(",")}]`);
    f.push(`price:${p.price}`);
    if (p.compareAtPrice) f.push(`compareAtPrice:${p.compareAtPrice}`);
    f.push(`image:"${esc(p.image)}"`);
    if (p.image2) f.push(`image2:"${esc(p.image2)}"`);
    f.push(`rating:${p.rating}`);
    f.push(`reviewCount:${p.reviewCount}`);
    if (p.badges.length) f.push(`badges:[${p.badges.map((b) => `"${b}"`).join(",")}]`);
    f.push(`shortDesc:"${esc(p.shortDesc)}"`);
    if (p.description) f.push(`description:"${esc(p.description)}"`);
    f.push(`benefits:[${p.benefits.map((b) => `"${esc(b)}"`).join(",")}]`);
    f.push(`howToUse:"${esc(p.howToUse)}"`);
    f.push(`ingredients:"${esc(p.ingredients)}"`);
    f.push(`whoFor:"${esc(p.whoFor)}"`);
    f.push(`inStock:${p.inStock}`);
    if (p.size) f.push(`size:"${esc(p.size)}"`);
    const variantRows = p.variants.map((v) => {
      const vf = [];
      vf.push(`variantId:"${esc(v.variantId)}"`);
      vf.push(`size:"${esc(v.size)}"`);
      vf.push(`price:${v.price}`);
      if (v.compareAtPrice) vf.push(`compareAtPrice:${v.compareAtPrice}`);
      vf.push(`inStock:${v.inStock}`);
      return "{" + vf.join(",") + "}";
    });
    f.push(`variants:[${variantRows.join(",")}]`);
    return "{" + f.join(",") + "}";
  });
  return (
    'import { Product } from "./types";\n' +
    "// AUTO-GENERATED at build time from the Shopify Storefront API — do not edit.\n" +
    "export const generatedProducts: Product[] = [\n" +
    rows.join(",\n") +
    "\n];\n"
  );
}

async function main() {
  console.log("[catalogue] fetching live catalogue from " + (DOMAIN || "(CATALOGUE_FIXTURE)"));
  const raw = await fetchAll();
  const usedSlugs = new Set();
  const mapped = raw.map((p) => toProduct(p, usedSlugs)).filter(Boolean);
  const min = process.env.CATALOGUE_FIXTURE ? 1 : 1;
  if (mapped.length < min) throw new Error("only " + mapped.length + " usable products");
  applyContentCache(mapped);
  fs.writeFileSync(OUT, serialise(mapped), "utf8");
  fs.writeFileSync(SNAPSHOT, JSON.stringify(mapped), "utf8");
  const byCat = {};
  for (const p of mapped) byCat[p.category] = (byCat[p.category] || 0) + 1;
  console.log(
    "[catalogue] wrote " + mapped.length + " products " + JSON.stringify(byCat)
  );
}

module.exports = { sourceHash, CONTENT_CACHE, SNAPSHOT };

if (require.main === module) {
main().catch((e) => {
  console.warn("[catalogue] live fetch failed, site will have no products until next build:", e.message);
  if (!fs.existsSync(OUT)) {
    fs.writeFileSync(
      OUT,
      'import { Product } from "./types";\nexport const generatedProducts: Product[] = [];\n',
      "utf8"
    );
  }
  process.exit(0);
});
}

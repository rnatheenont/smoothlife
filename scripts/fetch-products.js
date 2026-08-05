/* eslint-disable */
// Pulls the real Smooth Life catalogue from the live Shopify storefront at build
// time and writes src/data/products.generated.ts. This is the *only* source of
// products in the app — there is no hand-written/demo catalogue. If the fetch
// fails, the build still succeeds but the site will simply have no products
// until the next successful build.

const fs = require("fs");
const path = require("path");

const STORE = "https://www.smoothlife.com";
const OUT = path.join(__dirname, "..", "src", "data", "products.generated.ts");
const PER_PAGE = 250;
const MAX_PAGES = 24;

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
  return decodeEntities(String(html))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
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

/* ---------- classification ---------- */

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

/* ---------- body_html field extraction ---------- */

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
      out[field] =
        after && after.length > 8 && after !== lines[i]
          ? after
          : (lines[i + 1] || "");
    }
  }
  return out;
}

/* ---------- fetch ---------- */

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; SmoothLifeDemoBuild/1.0)",
      accept: "application/json",
    },
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return res.json();
}

async function fetchAll() {
  if (process.env.CATALOGUE_FIXTURE) {
    const fx = JSON.parse(fs.readFileSync(process.env.CATALOGUE_FIXTURE, "utf8"));
    return fx.products || fx;
  }
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await getJson(`${STORE}/products.json?limit=${PER_PAGE}&page=${page}`);
    const batch = (data && data.products) || [];
    all.push(...batch);
    process.stdout.write(`  page ${page}: ${batch.length} products\n`);
    if (batch.length < PER_PAGE) break;
  }
  return all;
}

/* ---------- mapping ---------- */

function toProduct(p, usedSlugs) {
  const variants = (p.variants || []).filter((v) => v && v.price != null);
  if (!variants.length) return null;

  const cheapest = variants.reduce((a, b) =>
    parseFloat(a.price) <= parseFloat(b.price) ? a : b
  );
  const price = Math.round(parseFloat(cheapest.price));
  if (!price || price <= 0) return null;

  const compare = cheapest.compare_at_price
    ? Math.round(parseFloat(cheapest.compare_at_price))
    : 0;

  const images = (p.images || []).filter((i) => i && i.src);
  if (!images.length) return null;
  const img = (i) => images[i].src + (images[i].src.includes("?") ? "&" : "?") + "width=700";

  const tags = (p.tags || []).join(" ");
  const hay = `${p.title} ${p.product_type} ${tags} ${p.vendor}`.toLowerCase();

  const category = matchRules(CATEGORY_RULES, hay, ["skincare"])[0];
  const softFallback =
    category === "skincare" || category === "body-care" ? ["dryness"] : [];
  const concerns = matchRules(CONCERN_RULES, hay, softFallback).slice(0, 3);

  const lines = blocks(p.body_html);
  const sec = sections(lines);
  // Benefits must not repeat the summary or the how-to-use / who-for sections.
  const claimed = new Set(
    [sec.howToUse, sec.ingredients, sec.whoFor].filter(Boolean)
  );
  const prose = lines.filter(
    (l) =>
      l.length > 25 &&
      !/^[•\-–]/.test(l) &&
      !claimed.has(l) &&
      !SECTION_KEYS.some(([, keys]) =>
        keys.some((k) => l.toLowerCase().startsWith(k))
      )
  );

  const badges = [];
  if (compare > price) badges.push("Sale");
  if (/แพ็ค|เซ็ต|pack|set|bundle|คู่/i.test(p.title)) badges.push("Bundle");
  const created = Date.parse(p.published_at || p.created_at || 0);
  if (created && Date.now() - created < 1000 * 60 * 60 * 24 * 60) badges.push("New");

  let slug = slugify(p.title, p.id);
  if (usedSlugs.has(slug)) slug = slug + "-" + String(p.id).slice(-5);
  usedSlugs.add(slug);

  const size =
    cheapest.title && cheapest.title !== "Default Title" ? cheapest.title : "";

  return {
    slug,
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
    ingredients: clip(sec.ingredients, 300),
    whoFor: clip(sec.whoFor, 240),
    inStock: variants.some((v) => v.available !== false),
    size,
  };
}

/* ---------- emit ---------- */

function serialise(list) {
  const rows = list.map((p) => {
    const f = [];
    f.push(`slug:"${esc(p.slug)}"`);
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
    return "{" + f.join(",") + "}";
  });
  return (
    'import { Product } from "./types";\n' +
    "// AUTO-GENERATED at build time from " + STORE + "/products.json — do not edit.\n" +
    "export const generatedProducts: Product[] = [\n" +
    rows.join(",\n") +
    "\n];\n"
  );
}

async function main() {
  console.log("[catalogue] fetching live catalogue from " + STORE);
  const raw = await fetchAll();
  const usedSlugs = new Set();
  const mapped = raw.map((p) => toProduct(p, usedSlugs)).filter(Boolean);
  const min = process.env.CATALOGUE_FIXTURE ? 1 : 10;
  if (mapped.length < min) throw new Error("only " + mapped.length + " usable products");
  fs.writeFileSync(OUT, serialise(mapped), "utf8");
  const byCat = {};
  for (const p of mapped) byCat[p.category] = (byCat[p.category] || 0) + 1;
  console.log(
    "[catalogue] wrote " + mapped.length + " products " + JSON.stringify(byCat)
  );
}

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

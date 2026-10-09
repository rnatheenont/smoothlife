import { test } from "node:test";
import assert from "node:assert/strict";
import { productMarkersIn, renderProductMarkers, type ResolvedProduct } from "./markers.ts";

// Run with: npm test
//
// Node runs these files directly, so nothing here may import through the "@/"
// alias — which is also why markers.ts takes a resolver instead of reaching
// for the catalogue itself.

const CATALOG: Record<string, ResolvedProduct> = {
  "smooth-e-baby-face-foam": {
    name: "Smooth E Baby Face Foam",
    url: "https://smoothlife.test/product/smooth-e-baby-face-foam",
  },
  "dentiste-nighttime-toothpaste": {
    name: "Dentiste Nighttime Toothpaste",
    url: "https://smoothlife.test/product/dentiste-nighttime-toothpaste",
  },
};

const resolve = (slug: string) => CATALOG[slug] ?? null;
const web = { allowsLinks: true, resolve };
/** A marketplace: the product exists, but a link out of the app does not. */
const market = { allowsLinks: false, resolve: (s: string) => (CATALOG[s] ? { name: CATALOG[s].name } : null) };

test("lists the slugs a draft mentions, deduplicated", () => {
  assert.deepEqual(
    productMarkersIn("ลอง [[smooth-e-baby-face-foam]] กับ [[dentiste-nighttime-toothpaste]] ค่ะ"),
    ["smooth-e-baby-face-foam", "dentiste-nighttime-toothpaste"]
  );
  assert.deepEqual(productMarkersIn("[[a-b]] แล้ว [[A-B]]"), ["a-b"]);
  assert.deepEqual(productMarkersIn("ไม่มีสินค้าเลยค่ะ"), []);
});

test("a single bracket is ordinary punctuation, not a marker", () => {
  assert.deepEqual(productMarkersIn("ราคา [ลด 20%] ค่ะ"), []);
  assert.equal(renderProductMarkers("ราคา [ลด 20%] ค่ะ", web), "ราคา [ลด 20%] ค่ะ");
});

test("a channel that allows links gets the name and the product page", () => {
  assert.equal(
    renderProductMarkers("แนะนำ [[smooth-e-baby-face-foam]] ค่ะ", web),
    "แนะนำ Smooth E Baby Face Foam\nhttps://smoothlife.test/product/smooth-e-baby-face-foam ค่ะ"
  );
});

test("a channel that bans links gets the name only", () => {
  assert.equal(
    renderProductMarkers("แนะนำ [[smooth-e-baby-face-foam]] ค่ะ", market),
    "แนะนำ Smooth E Baby Face Foam ค่ะ"
  );
});

test("the marker itself never reaches the customer when the slug is unknown", () => {
  const out = renderProductMarkers("แนะนำ [[smooth-e-gift-set-2019]] ค่ะ", web);
  assert.ok(!out.includes("[["), `marker leaked: ${out}`);
  assert.equal(out, "แนะนำ ค่ะ");
});

test("a dropped marker does not leave a blank line behind", () => {
  const out = renderProductMarkers(
    "สวัสดีค่ะ\n\n[[discontinued-item]]\n\n[[smooth-e-baby-face-foam]]\n\nสอบถามเพิ่มได้เลยค่ะ",
    web
  );
  assert.ok(!/\n{3,}/.test(out), `blank lines left behind:\n${out}`);
  assert.equal(
    out,
    "สวัสดีค่ะ\n\nSmooth E Baby Face Foam\nhttps://smoothlife.test/product/smooth-e-baby-face-foam\n\nสอบถามเพิ่มได้เลยค่ะ"
  );
});

test("a draft that was nothing but an unknown marker renders empty, so the caller can refuse to send it", () => {
  assert.equal(renderProductMarkers("[[discontinued-item]]", web), "");
});

test("Thai inside brackets is prose staff typed, not a marker", () => {
  // Slugs are ASCII. Bracketed Thai is left exactly as written — collapsing it
  // would silently eat text staff meant the customer to read.
  assert.deepEqual(productMarkersIn("[[ครีมกันแดด]]"), []);
  assert.equal(renderProductMarkers("ลอง [[ครีมกันแดด]] ดูค่ะ", web), "ลอง [[ครีมกันแดด]] ดูค่ะ");
});

test("the same product twice is rendered twice", () => {
  const out = renderProductMarkers("[[smooth-e-baby-face-foam]] และ [[smooth-e-baby-face-foam]]", market);
  assert.equal(out, "Smooth E Baby Face Foam และ Smooth E Baby Face Foam");
});

test("a slug typed in capitals still resolves", () => {
  assert.equal(renderProductMarkers("[[Smooth-E-Baby-Face-Foam]]", market), "Smooth E Baby Face Foam");
});

test("links are dropped when the channel allows them but the product has nowhere to link to", () => {
  const nameOnly = { allowsLinks: true, resolve: () => ({ name: "ชุดของขวัญเฉพาะกิจ" }) };
  assert.equal(renderProductMarkers("[[set-x]]", nameOnly), "ชุดของขวัญเฉพาะกิจ");
});

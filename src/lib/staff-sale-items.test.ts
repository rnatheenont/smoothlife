import { test } from "node:test";
import assert from "node:assert/strict";

import { parseItemInput, MAX_PER_PERSON, rpOf } from "./staff-sale.ts";

// The per-person ceiling. It is checked here rather than only in the admin
// form because the form is not the only way a row gets written — the bulk
// setter, a copied round and a direct PATCH all come through this function.

const row = (over: Record<string, unknown> = {}) => ({
  variant_id: "gid://shopify/ProductVariant/1",
  product_slug: "ortho-pro-toothbrush",
  regular_price: 160,
  staff_price: 64,
  ...over,
});

test("the shop's ceiling is six", () => {
  assert.equal(MAX_PER_PERSON, 6);
});

test("a limit at the ceiling is accepted", () => {
  const parsed = parseItemInput(row({ per_person_limit: 6 }));
  assert.ok("input" in parsed);
  assert.equal(parsed.input.per_person_limit, 6);
});

test("a limit over the ceiling is refused, not quietly clamped", () => {
  const parsed = parseItemInput(row({ per_person_limit: 7 }));
  assert.ok("error" in parsed);
  assert.match(parsed.error, /6/);
});

test("blank still means no limit", () => {
  for (const blank of ["", null, undefined]) {
    const parsed = parseItemInput(row({ per_person_limit: blank }));
    assert.ok("input" in parsed, String(blank));
    assert.equal(parsed.input.per_person_limit, null);
  }
});

test("zero and a fraction are still refused", () => {
  assert.ok("error" in parseItemInput(row({ per_person_limit: 0 })));
  assert.ok("error" in parseItemInput(row({ per_person_limit: 2.5 })));
});

// The RP the staff discount comes off. The catalogue price carries a 10%
// markup, so discounting the catalogue price hands staff a tenth more off
// than the screen says.

test("RP is the catalogue price with the markup taken back off", () => {
  assert.equal(rpOf({ regular_price: 418 }), 380);
  assert.equal(rpOf({ regular_price: 583 }), 530);
});

test("an RP somebody typed wins over the derived one", () => {
  assert.equal(rpOf({ regular_price: 418, rp_price: 399 }), 399);
  // Blank, null and zero are all "nobody has said", not "free".
  assert.equal(rpOf({ regular_price: 418, rp_price: null }), 380);
  assert.equal(rpOf({ regular_price: 418, rp_price: "" }), 380);
  assert.equal(rpOf({ regular_price: 418, rp_price: 0 }), 380);
});

test("an RP above the marked-up price is refused", () => {
  const parsed = parseItemInput(row({ regular_price: 418, rp_price: 500, staff_price: 190 }));
  assert.ok("error" in parsed);
});

test("the staff price is measured against RP, not the catalogue price", () => {
  // 200 is under the catalogue price of 418 but over the RP of 380 × 50%,
  // and over RP itself once RP is 190 — that last one is the mistake worth
  // catching, because it used to pass.
  const ok = parseItemInput(row({ regular_price: 418, rp_price: 380, staff_price: 190 }));
  assert.ok("input" in ok);
  assert.equal(ok.input.rp_price, 380);

  const bad = parseItemInput(row({ regular_price: 418, rp_price: 190, staff_price: 200 }));
  assert.ok("error" in bad);
});

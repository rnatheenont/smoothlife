import { test } from "node:test";
import assert from "node:assert/strict";

import { parseItemInput, MAX_PER_PERSON } from "./staff-sale.ts";

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

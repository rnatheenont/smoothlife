import { test } from "node:test";
import assert from "node:assert/strict";

import { normaliseGifts } from "./free-gift-input.ts";

// The last check between a typo in the admin form and a campaign that gives
// the wrong thing away to every customer who qualifies.

const V = "gid://shopify/ProductVariant/";

test("several gifts in one condition are kept in order", () => {
  const out = normaliseGifts([{ variantId: `${V}1`, qty: 2 }, { variantId: `${V}2` }], "");
  assert.equal(out.ok, true);
  assert.deepEqual(out.ok && out.gifts, [
    { variant_id: `${V}1`, product_slug: "", qty: 2 },
    { variant_id: `${V}2`, product_slug: "", qty: 1 },
  ]);
});

test("the same gift picked twice becomes one line with both quantities", () => {
  // Two line items of the same variant would reach Shopify as two rows of
  // the same product on the order.
  const out = normaliseGifts([{ variantId: `${V}1`, qty: 2 }, { variantId: `${V}1`, qty: 3 }], "");
  assert.deepEqual(out.ok && out.gifts, [{ variant_id: `${V}1`, product_slug: "", qty: 5 }]);
});

test("a condition with no gift is refused", () => {
  assert.equal(normaliseGifts([], "").ok, false);
  assert.equal(normaliseGifts(undefined, "").ok, false);
  assert.equal(normaliseGifts("gid://x", "").ok, false);
});

test("only a Shopify variant id counts as a gift", () => {
  for (const bad of ["", "12345", "gid://shopify/Product/1", V, null, 7]) {
    const out = normaliseGifts([{ variantId: bad }], "");
    assert.equal(out.ok, false, `accepted ${String(bad)}`);
  }
});

test("quantities must be whole and sane", () => {
  for (const bad of [0, -1, 1.5, 100, "two", NaN]) {
    assert.equal(normaliseGifts([{ variantId: `${V}1`, qty: bad }], "").ok, false, `accepted ${String(bad)}`);
  }
  assert.equal(normaliseGifts([{ variantId: `${V}1`, qty: 99 }], "").ok, true);
});

test("the error says which level it is about", () => {
  const out = normaliseGifts([], "ในระดับที่ 2");
  assert.equal(out.ok, false);
  assert.match(out.ok === false ? out.error : "", /ระดับที่ 2/);
});

test("a condition cannot hand over an unbounded pile", () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ variantId: `${V}${i}` }));
  assert.equal(normaliseGifts(many, "").ok, false);
});

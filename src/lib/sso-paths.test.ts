import { test } from "node:test";
import assert from "node:assert/strict";

import { wantsIdentity } from "./sso-paths.ts";

// This list decides who gets sent to Shopify and back before they can use the
// site. Getting it wrong in one direction costs a returning customer the
// convenience of already being signed in; in the other it costs every first
// time visitor 23 seconds on a phone, which is what it used to do.

test("the pages that are about a person do the round trip", () => {
  for (const path of [
    "/account",
    "/account/orders",
    "/account/orders/18967399891095",
    "/cart",
    "/checkout",
    "/checkout/thank-you",
  ]) {
    assert.ok(wantsIdentity(path), path);
  }
});

test("reading the shop does not", () => {
  for (const path of [
    "/",
    "/shop",
    "/shop/skincare",
    "/product/aromase-herbal-scalp-care-spray-40-ml-1",
    "/brands/dentiste",
    "/knowledge",
    "/promotions",
    "/flash-sale/a0a0b46c-5b35-4496-b4c8-423c1de60f73",
  ]) {
    assert.ok(!wantsIdentity(path), path);
  }
});

// A prefix match would send somebody reading an article to Shopify and back,
// which is the exact thing this list exists to stop.
test("a path that merely starts with the same letters is not a match", () => {
  for (const path of ["/cartoon", "/accounts", "/checkout-guide", "/cart-tips"]) {
    assert.ok(!wantsIdentity(path), path);
  }
});

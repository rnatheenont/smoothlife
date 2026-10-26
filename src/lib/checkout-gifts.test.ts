import { test } from "node:test";
import assert from "node:assert/strict";

import { giftLinesFrom } from "./checkout-gifts-rules.ts";
import type { FreeGiftPromo } from "../data/free-gifts.ts";
import type { CartLine } from "../data/coupons.ts";

// What ends up on the order, which is the half of this feature that costs
// money when it is wrong. The cart already tells the shopper they have earned
// a gift; these are the rules that decide whether the order they paid for
// actually contains one.

const NOW = Date.parse("2026-10-26T12:00:00Z");
const NONE = new Map<string, number | null>();

// The catalogue is handed in, so these tests never load it.
const noCatalogue = () => undefined;

const basket: CartLine[] = [
  { slug: "a", qty: 2, price: 500, brand: "Smooth E", category: "skincare" },
];

const spendPromo = (over: Partial<FreeGiftPromo> = {}): FreeGiftPromo => ({
  slug: "spend-1000",
  active: true,
  titleTh: "ครบพัน",
  titleEn: "Spend 1,000",
  kind: "spend",
  minSubtotal: 1000,
  giftProductSlug: "",
  giftVariantId: "gid://shopify/ProductVariant/1",
  giftQty: 1,
  displayOnly: false,
  ...over,
});

test("a basket over the threshold puts the gift on the order, free", () => {
  const lines = giftLinesFrom([spendPromo()], basket, NONE, NOW, noCatalogue);
  assert.deepEqual(lines, [
    { variantId: "gid://shopify/ProductVariant/1", quantity: 1, price: 0, promoSlug: "spend-1000" },
  ]);
});

test("a basket under the threshold gets nothing", () => {
  const under: CartLine[] = [{ ...basket[0], qty: 1 }];
  assert.deepEqual(giftLinesFrom([spendPromo()], under, NONE, NOW, noCatalogue), []);
});

// The warning this whole module is built around: the app on Shopify's side
// adds its own line for these, so adding ours too hands the shopper two.
test("a display-only promo is left to the app that owns it", () => {
  assert.deepEqual(giftLinesFrom([spendPromo({ displayOnly: true })], basket, NONE, NOW, noCatalogue), []);
});

test("a promo missing the flag entirely is treated as display-only", () => {
  const legacy = spendPromo();
  delete (legacy as { displayOnly?: boolean }).displayOnly;
  assert.deepEqual(giftLinesFrom([legacy], basket, NONE, NOW, noCatalogue), []);
});

test("a gift that has run out is not promised", () => {
  const empty = new Map<string, number | null>([["gid://shopify/ProductVariant/1", 0]]);
  assert.deepEqual(giftLinesFrom([spendPromo()], basket, empty, NOW, noCatalogue), []);
});

test("stock nobody could read is not stock at zero", () => {
  const unknown = new Map<string, number | null>([["gid://shopify/ProductVariant/1", null]]);
  assert.equal(giftLinesFrom([spendPromo()], basket, unknown, NOW, noCatalogue).length, 1);
});

test("a promo that has not started, and one that has ended, both give nothing", () => {
  const later = spendPromo({ starts: "2026-11-01T00:00:00Z" });
  const over = spendPromo({ expires: "2026-10-01T00:00:00Z" });
  assert.deepEqual(giftLinesFrom([later, over], basket, NONE, NOW, noCatalogue), []);
});

test("two promos landing on one gift become one line, not two", () => {
  const a = spendPromo({ slug: "a" });
  const b = spendPromo({ slug: "b", minSubtotal: 500 });
  const lines = giftLinesFrom([a, b], basket, NONE, NOW, noCatalogue);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2);
});

test("a gift with no variant anywhere is skipped rather than guessed at", () => {
  const nowhere = spendPromo({ giftVariantId: undefined, giftProductSlug: "does-not-exist" });
  assert.deepEqual(giftLinesFrom([nowhere], basket, NONE, NOW, noCatalogue), []);
});

// The ฿1,599 tier the shop runs today gives four things at once, which the
// single-gift columns could not hold.
test("a promo listing several gifts puts all of them on the order", () => {
  const many = spendPromo({
    gifts: [
      { variantId: "gid://shopify/ProductVariant/1", qty: 1 },
      { variantId: "gid://shopify/ProductVariant/2", qty: 2 },
      { variantId: "gid://shopify/ProductVariant/3", qty: 1 },
    ],
  });
  const lines = giftLinesFrom([many], basket, NONE, NOW, noCatalogue);
  assert.equal(lines.length, 3);
  assert.deepEqual(
    lines.map((l) => l.quantity),
    [1, 2, 1],
  );
});

test("the list wins over the single-gift fields when both are written", () => {
  const both = spendPromo({ gifts: [{ variantId: "gid://shopify/ProductVariant/9", qty: 1 }] });
  const lines = giftLinesFrom([both], basket, NONE, NOW, noCatalogue);
  assert.deepEqual(
    lines.map((l) => l.variantId),
    ["gid://shopify/ProductVariant/9"],
  );
});

// One empty shelf should cost the shopper that one gift, not the other three.
test("one gift out of stock does not cancel the rest", () => {
  const many = spendPromo({
    gifts: [
      { variantId: "gid://shopify/ProductVariant/1", qty: 1 },
      { variantId: "gid://shopify/ProductVariant/2", qty: 1 },
    ],
  });
  const empty = new Map<string, number | null>([["gid://shopify/ProductVariant/1", 0]]);
  const lines = giftLinesFrom([many], basket, empty, NOW, noCatalogue);
  assert.deepEqual(
    lines.map((l) => l.variantId),
    ["gid://shopify/ProductVariant/2"],
  );
});

// A tier that lists its gifts handed over nothing, because the list was not
// carried into the unlocked-tier shape and the fallback found two empty
// single-gift fields. The shop's ฿699 tier is written exactly this way.
test("a tier that lists its gifts hands them over", () => {
  const ladder: FreeGiftPromo = {
    slug: "ladder",
    active: true,
    titleTh: "บันได",
    titleEn: "Ladder",
    kind: "tiered",
    giftProductSlug: "",
    giftQty: 1,
    displayOnly: false,
    tierMode: "highest",
    tiers: [
      {
        minSubtotal: 500,
        giftProductSlug: "",
        giftQty: 1,
        gifts: [
          { variantId: "gid://shopify/ProductVariant/1", qty: 1 },
          { variantId: "gid://shopify/ProductVariant/2", qty: 1 },
        ],
      },
      {
        minSubtotal: 5000,
        giftProductSlug: "",
        giftQty: 1,
        gifts: [{ variantId: "gid://shopify/ProductVariant/3", qty: 1 }],
      },
    ],
  };
  const lines = giftLinesFrom([ladder], basket, NONE, NOW, noCatalogue);
  assert.deepEqual(
    lines.map((l) => l.variantId),
    ["gid://shopify/ProductVariant/1", "gid://shopify/ProductVariant/2"],
  );
});

// The app the shop runs pays the top tier reached and nothing under it.
test("tierMode highest pays only the tier reached, not the ones below", () => {
  const ladder: FreeGiftPromo = {
    slug: "ladder",
    active: true,
    titleTh: "บันได",
    titleEn: "Ladder",
    kind: "tiered",
    giftProductSlug: "",
    giftQty: 1,
    displayOnly: false,
    tierMode: "highest",
    tiers: [
      { minSubtotal: 500, giftProductSlug: "", giftQty: 1, gifts: [{ variantId: "low", qty: 1 }] },
      { minSubtotal: 900, giftProductSlug: "", giftQty: 1, gifts: [{ variantId: "high", qty: 1 }] },
    ],
  };
  const lines = giftLinesFrom([ladder], basket, NONE, NOW, noCatalogue);
  assert.deepEqual(
    lines.map((l) => l.variantId),
    ["high"],
  );
});

test("every line it returns is free", () => {
  for (const line of giftLinesFrom([spendPromo()], basket, NONE, NOW, noCatalogue)) {
    assert.equal(line.price, 0);
  }
});

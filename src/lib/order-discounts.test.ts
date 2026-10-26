import { test } from "node:test";
import assert from "node:assert/strict";

import { orderDiscountFrom } from "./order-discounts.ts";
import type { FreeGiftPromo } from "../data/free-gifts.ts";
import type { CartLine } from "../data/coupons.ts";

// Money off the order, which is the half of this that a shop loses when it
// is wrong in the generous direction.

const NOW = Date.parse("2026-10-26T12:00:00Z");

const basket: CartLine[] = [
  { slug: "a", qty: 2, price: 500, brand: "Smooth E", category: "skincare" },
];

const ladder = (over: Partial<FreeGiftPromo> = {}): FreeGiftPromo => ({
  slug: "order-goal",
  active: true,
  titleTh: "ยิ่งซื้อยิ่งลด",
  titleEn: "Order goal",
  kind: "tiered",
  giftProductSlug: "",
  giftQty: 1,
  displayOnly: false,
  rewardType: "order_discount",
  tiers: [
    { minSubtotal: 500, giftProductSlug: "", giftQty: 1, discountType: "percentage", discountValue: 10 },
    { minSubtotal: 1000, giftProductSlug: "", giftQty: 1, discountType: "percentage", discountValue: 20 },
  ],
  ...over,
});

test("the highest tier reached is the one that pays", () => {
  // ฿1,000 clears both rungs; 20% is what the shopper would expect to see.
  const d = orderDiscountFrom([ladder()], basket, NOW);
  assert.equal(d?.amount, 200);
  assert.equal(d?.label, "ซื้อครบ ฿1,000");
});

test("a basket short of the first rung earns nothing", () => {
  const small: CartLine[] = [{ ...basket[0], qty: 1, price: 400 }];
  assert.equal(orderDiscountFrom([ladder()], small, NOW), null);
});

test("only one campaign pays, and it is the larger", () => {
  // Two stacking on one order is how a shop gives away more than it meant to.
  const small = ladder({ slug: "small", tiers: [{ minSubtotal: 500, giftProductSlug: "", giftQty: 1, discountType: "percentage", discountValue: 5 }] });
  const big = ladder({ slug: "big", tiers: [{ minSubtotal: 500, giftProductSlug: "", giftQty: 1, discountType: "percentage", discountValue: 15 }] });
  const d = orderDiscountFrom([small, big], basket, NOW);
  assert.equal(d?.promoSlug, "big");
  assert.equal(d?.amount, 150);
});

test("a volume campaign counts items, not baht", () => {
  const byItems = ladder({
    triggerType: "quantity",
    tiers: [{ minSubtotal: 3, giftProductSlug: "", giftQty: 1, discountType: "percentage", discountValue: 25 }],
  });
  assert.equal(orderDiscountFrom([byItems], basket, NOW), null);
  const three: CartLine[] = [{ ...basket[0], qty: 3 }];
  const d = orderDiscountFrom([byItems], three, NOW);
  assert.equal(d?.amount, 375);
  assert.equal(d?.label, "ซื้อครบ 3 ชิ้น");
});

test("a fixed amount never exceeds the order", () => {
  const flat = ladder({
    kind: "spend",
    minSubtotal: 100,
    tiers: undefined,
    discountType: "fixed",
    discountValue: 99999,
  });
  assert.equal(orderDiscountFrom([flat], basket, NOW)?.amount, 1000);
});

test("a gift campaign is not an order discount", () => {
  assert.equal(orderDiscountFrom([ladder({ rewardType: "gift" })], basket, NOW), null);
});

test("display-only campaigns take nothing off", () => {
  // Same rule as gifts: a mirror of somebody else's campaign must not also
  // discount the order we build.
  assert.equal(orderDiscountFrom([ladder({ displayOnly: true })], basket, NOW), null);
});

test("an expired campaign pays nothing", () => {
  assert.equal(orderDiscountFrom([ladder({ expires: "2026-10-01T00:00:00Z" })], basket, NOW), null);
  assert.equal(orderDiscountFrom([ladder({ starts: "2026-12-01T00:00:00Z" })], basket, NOW), null);
});

test("\"free\" is the dropdown's default, not an instruction to give the order away", () => {
  const silly = ladder({
    kind: "spend",
    minSubtotal: 100,
    tiers: undefined,
    discountType: "free",
    discountValue: 50,
  });
  assert.equal(orderDiscountFrom([silly], basket, NOW), null);
});

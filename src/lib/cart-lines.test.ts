import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLines,
  clampQty,
  giftLineFrom,
  reconcileItems,
  sameLine,
  stockOf,
  subtotalOf,
  type CartItem,
  type ProductsBySlug,
} from "./cart-lines.ts";
import type { CartProduct } from "../data/cart-product.ts";

// The cart's arithmetic, tested where it is decided.
//
// These used to be lines inside the provider, fed by the whole catalogue
// sitting in the browser. The catalogue now arrives a few products at a
// time over the network, which means the cart has to be right while it is
// still half-loaded — these are the cases that only exist because of that.

function product(over: Partial<CartProduct> = {}): CartProduct {
  return {
    slug: "serum",
    name: "เซรั่ม",
    brand: "Smooth E",
    category: "skincare",
    image: "https://cdn/serum.jpg",
    price: 390,
    compareAtPrice: 490,
    variantId: "v-30",
    size: "30 ml.",
    variants: [
      { variantId: "v-30", size: "30 ml.", price: 390, compareAtPrice: 490, inStock: true, quantity: 4 },
      { variantId: "v-50", size: "50 ml.", price: 590, inStock: true },
    ],
    ...over,
  };
}

const bySlug: ProductsBySlug = { serum: product() };

test("a line takes its own variant's price, not the product's", () => {
  const lines = buildLines([{ slug: "serum", variantId: "v-50", qty: 2 }], bySlug);
  assert.equal(lines[0].price, 590);
  assert.equal(lines[0].size, "50 ml.");
  assert.equal(subtotalOf(lines), 1180);
});

test("a line whose variant no longer exists falls back to the product price", () => {
  const lines = buildLines([{ slug: "serum", variantId: "v-gone", qty: 1 }], bySlug);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].price, 390);
  assert.equal(lines[0].compareAtPrice, 490);
});

test("an item whose product has not arrived yet draws no line and costs nothing", () => {
  const items: CartItem[] = [
    { slug: "serum", variantId: "v-30", qty: 1 },
    { slug: "not-fetched-yet", variantId: "v-x", qty: 3 },
  ];
  const lines = buildLines(items, bySlug);
  assert.equal(lines.length, 1);
  // The money on screen never includes a line the customer cannot see.
  assert.equal(subtotalOf(lines), 390);
});

test("reconcile leaves an unfetched item exactly as it is", () => {
  const items: CartItem[] = [{ slug: "not-fetched-yet", variantId: "", qty: 99 }];
  // A slow connection must not look like a product that stopped being sold.
  assert.deepEqual(reconcileItems(items, bySlug), items);
});

test("reconcile fills in the default variant for an item added without one", () => {
  const next = reconcileItems([{ slug: "serum", variantId: "", qty: 1 }], bySlug);
  assert.equal(next[0].variantId, "v-30");
});

test("reconcile caps a quantity at the stock the shop publishes", () => {
  const next = reconcileItems([{ slug: "serum", variantId: "v-30", qty: 10 }], bySlug);
  assert.equal(next[0].qty, 4);
});

test("reconcile leaves a quantity alone when stock is unknown", () => {
  // v-50 has no quantity: unknown, not zero.
  const next = reconcileItems([{ slug: "serum", variantId: "v-50", qty: 10 }], bySlug);
  assert.equal(next[0].qty, 10);
});

test("reconcile returns the same array when nothing needed changing", () => {
  const items: CartItem[] = [{ slug: "serum", variantId: "v-30", qty: 2 }];
  // Identity matters: this feeds a setState on every fetch, and a new array
  // every time is a render loop.
  assert.equal(reconcileItems(items, bySlug), items);
});

test("stock of an unknown variant is undefined, never zero", () => {
  assert.equal(stockOf(product(), "v-gone"), undefined);
  assert.equal(stockOf(undefined, "v-30"), undefined);
  assert.equal(clampQty(7, undefined), 7);
  assert.equal(clampQty(7, 3), 3);
});

test("a subscription line never merges into a one-off line of the same variant", () => {
  const sub: CartItem = { slug: "serum", variantId: "v-30", qty: 1, subscribeMonths: 6 };
  assert.equal(sameLine(sub, "v-30"), false);
  assert.equal(sameLine(sub, "v-30", 6), true);
});

test("a gift line is free, and a missing gift product makes no line at all", () => {
  const gift = giftLineFrom(product(), 2, "promo-x");
  assert.equal(gift?.price, 0);
  assert.equal(gift?.isGift, true);
  assert.equal(giftLineFrom(undefined, 1, "promo-x"), null);
});

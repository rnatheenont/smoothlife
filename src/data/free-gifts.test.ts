import { test } from "node:test";
import assert from "node:assert/strict";

import { giftsOf } from "./free-gifts.ts";

// giftsOf is the one place that decides between the two ways a gift can be
// written down, so the two shapes have to come out the same — not just the
// same variant, the same everything the cart draws with.

test("a gift list is returned as written", () => {
  const gifts = [
    { variantId: "gid://v/1", qty: 1, title: "A", image: "a.jpg", stock: 5 },
    { variantId: "gid://v/2", qty: 2, title: "B", image: "b.jpg", stock: 0 },
  ];
  assert.deepEqual(giftsOf({ gifts }), gifts);
});

test("a single gift keeps its name, picture and stock", () => {
  // Written the old way — name, picture and stock live beside the gift
  // rather than on it. Dropping them is how a real promo (the ฿990 tote)
  // became a nameless, pictureless "ของแถม" tile in the cart on 26 Oct 69:
  // the API sent all three and this function threw them away.
  assert.deepEqual(
    giftsOf({
      giftVariantId: "gid://v/9",
      giftQty: 1,
      giftTitle: "[Free Gift] White Smoothlife.com Spunbond Bag",
      giftImage: "tote.jpg",
      giftStock: 4851,
    }),
    [
      {
        variantId: "gid://v/9",
        productSlug: undefined,
        qty: 1,
        title: "[Free Gift] White Smoothlife.com Spunbond Bag",
        image: "tote.jpg",
        stock: 4851,
      },
    ],
  );
});

test("a list wins over the single fields when both are set", () => {
  const out = giftsOf({
    gifts: [{ variantId: "gid://v/1", qty: 1, title: "list" }],
    giftVariantId: "gid://v/9",
    giftTitle: "single",
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "list");
});

test("a promo that hands over nothing yields nothing", () => {
  assert.deepEqual(giftsOf({}), []);
  assert.deepEqual(giftsOf({ gifts: [] }), []);
  // An empty slug is what the database stores for "not set".
  assert.deepEqual(giftsOf({ giftProductSlug: "" }), []);
});

test("a gift named only by slug still comes through", () => {
  assert.deepEqual(giftsOf({ giftProductSlug: "tote-bag", giftQty: 2 }), [
    { variantId: undefined, productSlug: "tote-bag", qty: 2, title: undefined, image: undefined, stock: undefined },
  ]);
});

test("qty defaults to one", () => {
  assert.equal(giftsOf({ giftVariantId: "gid://v/9" })[0].qty, 1);
});

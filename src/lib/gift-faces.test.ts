import { test } from "node:test";
import assert from "node:assert/strict";

import { giftLabel, giftFaces, availableGiftFaces, leadGiftFace } from "./gift-faces.ts";

// What the widgets draw. Every one of them used to work this out for itself,
// and every one of them got it wrong in the same way.

const shelfName = "[Free Gift] White Smoothlife.com Spunbond Bag";

test("the staff prefix is not shown to shoppers", () => {
  assert.equal(giftLabel(shelfName), "White Smoothlife.com Spunbond Bag");
  assert.equal(giftLabel("TEST | [Free Gift] Tote"), "Tote");
  assert.equal(giftLabel("Plain name"), "Plain name");
  assert.equal(giftLabel(undefined), undefined);
  assert.equal(giftLabel("[Free Gift]  "), undefined);
});

test("a gift written the old way still has a name and a picture", () => {
  // The shape every promo on the shop right now is NOT written in — which is
  // exactly why it has to keep working.
  const [face] = giftFaces({
    giftVariantId: "gid://v/9",
    giftTitle: shelfName,
    giftImage: "tote.jpg",
    giftStock: 4851,
  });
  assert.equal(face.title, "White Smoothlife.com Spunbond Bag");
  assert.equal(face.image, "tote.jpg");
  assert.equal(face.soldOut, false);
});

test("a gift named by slug borrows the catalogue's name and photo", () => {
  const catalogue = (slug: string) => (slug === "tote" ? { name: "ถุงผ้า", image: "c.jpg" } : undefined);
  const [face] = giftFaces({ giftProductSlug: "tote" }, catalogue);
  assert.equal(face.title, "ถุงผ้า");
  assert.equal(face.image, "c.jpg");
});

test("stock of zero is sold out; unknown stock is not", () => {
  const faces = giftFaces({
    gifts: [
      { variantId: "a", qty: 1, title: "A", stock: 0 },
      { variantId: "b", qty: 1, title: "B", stock: null },
      { variantId: "c", qty: 1, title: "C" },
      { variantId: "d", qty: 1, title: "D", stock: 3 },
    ],
  });
  assert.deepEqual(
    faces.map((f) => f.soldOut),
    [true, false, false, false],
  );
  assert.deepEqual(
    availableGiftFaces({
      gifts: [
        { variantId: "a", qty: 1, title: "A", stock: 0 },
        { variantId: "d", qty: 1, title: "D", stock: 3 },
      ],
    }).map((f) => f.title),
    ["D"],
  );
});

test("the lead gift is one that is both in stock and photographed", () => {
  const lead = leadGiftFace({
    gifts: [
      { variantId: "a", qty: 1, title: "A", image: "a.jpg", stock: 0 },
      { variantId: "b", qty: 1, title: "B", stock: 5 },
      { variantId: "c", qty: 1, title: "C", image: "c.jpg", stock: 5 },
    ],
  });
  assert.equal(lead?.title, "C");
});

test("a promo whose every gift is gone still names one rather than nothing", () => {
  // The card is on the page because the API let the promo through; drawing
  // an empty tile there would be worse than naming the thing we have.
  const lead = leadGiftFace({ gifts: [{ variantId: "a", qty: 1, title: "A", image: "a.jpg", stock: 0 }] });
  assert.equal(lead?.title, "A");
});

test("a promo that hands over nothing has no faces", () => {
  assert.deepEqual(giftFaces({}), []);
});

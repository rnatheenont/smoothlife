import test from "node:test";
import assert from "node:assert/strict";
import { toFeaturedOrder, type Rankable } from "./featured-order.ts";

type Item = Rankable & { id: string };
const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  brand: extra.brand ?? id,
  price: extra.price ?? 100,
  ...extra,
});

const ids = (items: Item[]) => toFeaturedOrder(items).map((p) => p.id);

test("a product people open beats one the shop is promoting", () => {
  // The whole point of the change. A New badge used to be the strongest thing
  // the order knew; now it loses to measured demand.
  const order = ids([item("promoted", { badges: ["New"] }), item("opened", { views: 12 })]);
  assert.deepEqual(order, ["opened", "promoted"]);
});

test("more opens ranks higher", () => {
  assert.deepEqual(ids([item("few", { views: 3 }), item("many", { views: 90 })]), ["many", "few"]);
});

test("opens outweigh sales", () => {
  // Deliberate: the open count is thirty days old at most, while sold is all
  // time, and "ขายดี" already answers the sales question on its own.
  const order = ids([item("sells", { sold: 500 }), item("opened", { views: 40 })]);
  assert.deepEqual(order, ["opened", "sells"]);
});

test("one hero product cannot bury everything behind it", () => {
  // log1p, not linear. A product with a tenth of the leader's opens still
  // scores a real fraction rather than a rounding error, so the badge and
  // discount terms can still separate the rest of the page.
  const hero = item("hero", { views: 1000 });
  const tenth = item("tenth", { views: 100 });
  const order = ids([item("plain"), hero, tenth]);
  assert.deepEqual(order, ["hero", "tenth", "plain"]);
});

test("sales order the tail nobody has opened yet", () => {
  // The day this shipped, no product had an open count. Sales are what makes
  // the order better than badges alone in the meantime.
  const order = ids([
    item("unsold", { brand: "a" }),
    item("popular", { brand: "b", sold: 200 }),
  ]);
  assert.deepEqual(order, ["popular", "unsold"]);
});

test("the unopened tail is still spread across brands", () => {
  // Three of one brand and three of another must not come out as two blocks:
  // with no demand signal the only thing left to avoid is the wall of
  // near-identical bottles this ordering was first written for.
  const order = ids([
    item("a1", { brand: "A" }),
    item("a2", { brand: "A" }),
    item("a3", { brand: "A" }),
    item("b1", { brand: "B" }),
    item("b2", { brand: "B" }),
    item("b3", { brand: "B" }),
  ]);
  for (let i = 1; i < order.length; i++) {
    assert.notEqual(order[i][0], order[i - 1][0], `${order.join(",")} puts two of one brand together`);
  }
});

test("opened products keep their true order instead of being spread by brand", () => {
  // Once demand is measured, that measurement is the answer. Interleaving it
  // by brand would mean the second-most-wanted product is whatever another
  // brand's best is, which is the shop overruling its customers again.
  const order = ids([
    item("x-top", { brand: "X", views: 100 }),
    item("x-second", { brand: "X", views: 80 }),
    item("y", { brand: "Y", views: 5 }),
  ]);
  assert.deepEqual(order, ["x-top", "x-second", "y"]);
});

test("a deeper discount still breaks a tie in the tail", () => {
  const order = ids([
    item("shallow", { brand: "a", price: 90, compareAtPrice: 100, badges: ["Sale"] }),
    item("deep", { brand: "b", price: 40, compareAtPrice: 100, badges: ["Sale"] }),
  ]);
  assert.deepEqual(order, ["deep", "shallow"]);
});

test("every product comes out exactly once", () => {
  // The round-robin drains several queues at once; an off-by-one there would
  // silently drop products from the shop rather than fail.
  const items = Array.from({ length: 37 }, (_, i) =>
    item(`p${i}`, { brand: `b${i % 5}`, views: i % 3 === 0 ? i : undefined, sold: i })
  );
  const order = ids(items);
  assert.equal(order.length, items.length);
  assert.equal(new Set(order).size, items.length);
});

test("an empty shelf is not an error", () => {
  assert.deepEqual(ids([]), []);
});

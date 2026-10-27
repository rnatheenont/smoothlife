import { test } from "node:test";
import assert from "node:assert/strict";

import { giftLinesFrom, giftOrderTags } from "./checkout-gifts-rules.ts";
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

// The cart applies the same rule, in cart-context's linesForGifts: a number
// at or below zero means gone, anything else stands. Written down here
// because the two drifting apart is what put an out-of-stock gift in a
// shopper's cart that the order would not have carried.
test("stock at or below zero is gone, anything else stands", () => {
  const cases: [number | null | undefined, boolean][] = [
    [0, false],
    [-3, false],
    [1, true],
    [null, true],
    [undefined, true],
  ];
  for (const [stock, expected] of cases) {
    const map = new Map<string, number | null>();
    if (stock !== undefined) map.set("gid://shopify/ProductVariant/1", stock);
    const lines = giftLinesFrom([spendPromo()], basket, map, NOW, noCatalogue);
    assert.equal(lines.length > 0, expected, `stock ${String(stock)}`);
  }
});

test("every line it returns is free", () => {
  for (const line of giftLinesFrom([spendPromo()], basket, NONE, NOW, noCatalogue)) {
    assert.equal(line.price, 0);
  }
});

// The tags the Shopify order is created with. A gift is a ฿0 line and nothing
// else, so these are the only thing that makes a giveaway countable later.

test("tags name every promo that gave something", () => {
  assert.deepEqual(
    giftOrderTags([
      { price: 679, promoSlug: undefined },
      { price: 0, promoSlug: "aov-free-gift-orders" },
      { price: 0, promoSlug: "aov-gwp-oct-25-31::tier-1" },
    ]),
    ["free-gift", "free-gift:aov-free-gift-orders", "free-gift:aov-gwp-oct-25-31"],
  );
});

test("an order with no gift gets no tag at all", () => {
  assert.deepEqual(giftOrderTags([{ price: 679 }, { price: 1599 }]), []);
});

test("a reward at a discount is tagged like any other", () => {
  // Not every reward is free — a campaign can sell one at 30% off, and it is
  // still that campaign's doing.
  assert.deepEqual(giftOrderTags([{ price: 210, promoSlug: "spend-1000" }]), [
    "free-gift",
    "free-gift:spend-1000",
  ]);
});

test("a plain paid line carries no campaign and no tag", () => {
  assert.deepEqual(giftOrderTags([{ price: 679 }, { price: 1599 }]), []);
});

test("one campaign named twice is still one tag", () => {
  assert.deepEqual(
    giftOrderTags([
      { price: 0, promoSlug: "gwp::tier-0" },
      { price: 0, promoSlug: "gwp::tier-1" },
    ]),
    ["free-gift", "free-gift:gwp"],
  );
});

test("a gift two promos both gave keeps both campaigns", () => {
  assert.deepEqual(giftOrderTags([{ price: 0, promoSlug: "a,b::tier-2" }]), [
    "free-gift",
    "free-gift:a",
    "free-gift:b",
  ]);
});

test("two promos landing on one gift merge without losing either", () => {
  const promos: FreeGiftPromo[] = [
    spendPromo({ slug: "first" }),
    spendPromo({ slug: "second" }),
  ];
  const [line] = giftLinesFrom(promos, basket, NONE, NOW, noCatalogue);
  assert.equal(line.quantity, 2);
  assert.deepEqual(giftOrderTags([line]), ["free-gift", "free-gift:first", "free-gift:second"]);
});

// The app's campaign settings this table could not express until now:
// exclusions, a scope, a threshold counted in items, and a cap on how many
// of a milestone's gifts are handed over.

test("an excluded product does not pay toward the threshold", () => {
  // The live Free-gift-orders campaign excludes the very product it gives
  // away, so the gift cannot trigger itself.
  const promo = spendPromo({ minSubtotal: 1000, excludedProductSlugs: ["a"] });
  assert.deepEqual(giftLinesFrom([promo], basket, NONE, NOW, noCatalogue), []);
});

test("a scope limits which lines count", () => {
  const onlySmoothE = spendPromo({ minSubtotal: 1000, scopeBrands: ["Smooth E"] });
  const onlyDentiste = spendPromo({ minSubtotal: 1000, scopeBrands: ["Dentiste"] });
  assert.equal(giftLinesFrom([onlySmoothE], basket, NONE, NOW, noCatalogue).length, 1);
  assert.deepEqual(giftLinesFrom([onlyDentiste], basket, NONE, NOW, noCatalogue), []);
});

test("a threshold can count items instead of baht", () => {
  // The basket is 2 items worth ฿1,000. Counted as money it clears a ฿1,000
  // threshold; counted as items it does not clear a threshold of 3.
  const byItems = spendPromo({ triggerType: "quantity", minSubtotal: 3 });
  assert.deepEqual(giftLinesFrom([byItems], basket, NONE, NOW, noCatalogue), []);
  const reachable = spendPromo({ triggerType: "quantity", minSubtotal: 2 });
  assert.equal(giftLinesFrom([reachable], basket, NONE, NOW, noCatalogue).length, 1);
});

test("maxGifts caps a milestone that lists more", () => {
  const promo = spendPromo({
    minSubtotal: 1000,
    maxGifts: 2,
    gifts: [
      { variantId: "gid://shopify/ProductVariant/1", qty: 1 },
      { variantId: "gid://shopify/ProductVariant/2", qty: 1 },
      { variantId: "gid://shopify/ProductVariant/3", qty: 1 },
    ],
  });
  const lines = giftLinesFrom([promo], basket, NONE, NOW, noCatalogue);
  assert.deepEqual(
    lines.map((l) => l.variantId),
    ["gid://shopify/ProductVariant/1", "gid://shopify/ProductVariant/2"],
  );
});

test("no cap means every listed gift is handed over", () => {
  const promo = spendPromo({
    minSubtotal: 1000,
    gifts: [
      { variantId: "gid://shopify/ProductVariant/1", qty: 1 },
      { variantId: "gid://shopify/ProductVariant/2", qty: 1 },
    ],
  });
  assert.equal(giftLinesFrom([promo], basket, NONE, NOW, noCatalogue).length, 2);
});

// A reward is not always a giveaway, and is not always chosen for the shopper.

test("a percentage reward is charged against its retail price", () => {
  const promo = spendPromo({
    minSubtotal: 1000,
    discountType: "percentage",
    discountValue: 70,
    gifts: [{ variantId: "gid://shopify/ProductVariant/1", qty: 1, price: 300 }],
  });
  const [line] = giftLinesFrom([promo], basket, NONE, NOW, noCatalogue);
  assert.equal(line.price, 90);
});

test("a fixed-price reward never costs more than the product does", () => {
  const promo = spendPromo({
    minSubtotal: 1000,
    discountType: "fixed",
    discountValue: 500,
    gifts: [{ variantId: "gid://shopify/ProductVariant/1", qty: 1, price: 300 }],
  });
  assert.equal(giftLinesFrom([promo], basket, NONE, NOW, noCatalogue)[0].price, 300);
});

test("a priced reward we cannot price is left off the order", () => {
  // Giving it away would hand over a product meant to be sold at a discount,
  // and the cart refuses to show it for the same reason.
  const promo = spendPromo({
    minSubtotal: 1000,
    discountType: "percentage",
    discountValue: 50,
    gifts: [{ variantId: "gid://shopify/ProductVariant/1", qty: 1 }],
  });
  assert.deepEqual(giftLinesFrom([promo], basket, NONE, NOW, noCatalogue), []);
  // …unless the shelf can price it.
  const priced = giftLinesFrom([promo], basket, NONE, NOW, noCatalogue, () => 200);
  assert.equal(priced[0].price, 100);
});

test("a free reward needs no price at all", () => {
  const promo = spendPromo({ minSubtotal: 1000 });
  assert.equal(giftLinesFrom([promo], basket, NONE, NOW, noCatalogue)[0].price, 0);
});

test("a campaign the shopper chooses from gives nothing until they choose", () => {
  const promo = spendPromo({
    minSubtotal: 1000,
    giftChoice: "customer",
    maxGifts: 1,
    gifts: [
      { variantId: "gid://shopify/ProductVariant/1", qty: 1 },
      { variantId: "gid://shopify/ProductVariant/2", qty: 1 },
    ],
  });
  assert.deepEqual(giftLinesFrom([promo], basket, NONE, NOW, noCatalogue), []);

  const picked = giftLinesFrom(
    [promo],
    basket,
    NONE,
    NOW,
    noCatalogue,
    undefined,
    new Map([["spend-1000", ["gid://shopify/ProductVariant/2"]]]),
  );
  assert.deepEqual(
    picked.map((l) => l.variantId),
    ["gid://shopify/ProductVariant/2"],
  );
});

test("a pick the campaign never offered is ignored", () => {
  // The browser's claim can only ever narrow what the promo would have given.
  const promo = spendPromo({
    minSubtotal: 1000,
    giftChoice: "customer",
    gifts: [{ variantId: "gid://shopify/ProductVariant/1", qty: 1 }],
  });
  const lines = giftLinesFrom(
    [promo],
    basket,
    NONE,
    NOW,
    noCatalogue,
    undefined,
    new Map([["spend-1000", ["gid://shopify/ProductVariant/999"]]]),
  );
  assert.deepEqual(lines, []);
});

test("the cap still applies to what the shopper picked", () => {
  const promo = spendPromo({
    minSubtotal: 1000,
    giftChoice: "customer",
    maxGifts: 1,
    gifts: [
      { variantId: "gid://shopify/ProductVariant/1", qty: 1 },
      { variantId: "gid://shopify/ProductVariant/2", qty: 1 },
    ],
  });
  const lines = giftLinesFrom(
    [promo],
    basket,
    NONE,
    NOW,
    noCatalogue,
    undefined,
    new Map([["spend-1000", ["gid://shopify/ProductVariant/1", "gid://shopify/ProductVariant/2"]]]),
  );
  assert.equal(lines.length, 1);
});

// Who a campaign is for, and a second cart rule joined with AND — the two
// halves of the app's "Custom Discount" that this table could not express.

test("a tier-targeted campaign skips everyone else", () => {
  const goldOnly = spendPromo({ minSubtotal: 1000, customerTiers: ["Gold"] });
  assert.deepEqual(giftLinesFrom([goldOnly], basket, NONE, NOW, noCatalogue), []);
  assert.equal(
    giftLinesFrom([goldOnly], basket, NONE, NOW, noCatalogue, undefined, new Map(), {
      tier: "Gold",
    }).length,
    1,
  );
});

test("a guest is nobody in particular, so a targeted campaign excludes them", () => {
  // Undefined is a guest or a page that has not loaded the account — either
  // way we cannot place them, and placing them wrongly gives product away.
  const silverOnly = spendPromo({ minSubtotal: 1000, customerTiers: ["Silver"] });
  assert.deepEqual(
    giftLinesFrom([silverOnly], basket, NONE, NOW, noCatalogue, undefined, new Map(), undefined),
    [],
  );
});

test("a first-order campaign is for somebody who has not ordered", () => {
  const firstOnly = spendPromo({ minSubtotal: 1000, firstOrderOnly: true });
  assert.equal(
    giftLinesFrom([firstOnly], basket, NONE, NOW, noCatalogue, undefined, new Map(), {
      orderCount: 0,
    }).length,
    1,
  );
  assert.deepEqual(
    giftLinesFrom([firstOnly], basket, NONE, NOW, noCatalogue, undefined, new Map(), {
      orderCount: 3,
    }),
    [],
  );
});

test("both cart rules have to hold, not either", () => {
  // The basket is 2 items worth ฿1,000: it clears the money and misses the
  // count, and a campaign asking for both is not earned.
  const both = spendPromo({ minSubtotal: 1000, minQty: 3 });
  assert.deepEqual(giftLinesFrom([both], basket, NONE, NOW, noCatalogue), []);
  const three: CartLine[] = [{ ...basket[0], qty: 3 }];
  assert.equal(giftLinesFrom([both], three, NONE, NOW, noCatalogue).length, 1);
});

// When a campaign runs. One pair of dates could only say "from here to
// there"; a campaign over two weekends needs to say it twice.

test("a campaign with no schedule runs", () => {
  assert.equal(giftLinesFrom([spendPromo({ minSubtotal: 1000 })], basket, NONE, NOW, noCatalogue).length, 1);
});

test("the single start and expiry still work", () => {
  const future = spendPromo({ minSubtotal: 1000, starts: "2026-12-01T00:00:00Z" });
  assert.deepEqual(giftLinesFrom([future], basket, NONE, NOW, noCatalogue), []);
  const past = spendPromo({ minSubtotal: 1000, expires: "2026-10-01T00:00:00Z" });
  assert.deepEqual(giftLinesFrom([past], basket, NONE, NOW, noCatalogue), []);
});

test("several windows are ORs, not one long range", () => {
  // NOW is 26 Oct. The campaign runs the 20th-22nd and the 25th-28th; the
  // gap between them is not a time it runs, which a single pair cannot say.
  const twoWeekends = spendPromo({
    minSubtotal: 1000,
    windows: [
      { starts: "2026-10-20T00:00:00Z", ends: "2026-10-22T23:59:00Z" },
      { starts: "2026-10-25T00:00:00Z", ends: "2026-10-28T23:59:00Z" },
    ],
  });
  assert.equal(giftLinesFrom([twoWeekends], basket, NONE, NOW, noCatalogue).length, 1);

  const bothPast = spendPromo({
    minSubtotal: 1000,
    windows: [
      { starts: "2026-10-01T00:00:00Z", ends: "2026-10-05T00:00:00Z" },
      { starts: "2026-10-10T00:00:00Z", ends: "2026-10-15T00:00:00Z" },
    ],
  });
  assert.deepEqual(giftLinesFrom([bothPast], basket, NONE, NOW, noCatalogue), []);
});

test("the gap between two windows is closed", () => {
  const paused = spendPromo({
    minSubtotal: 1000,
    windows: [
      { starts: "2026-10-01T00:00:00Z", ends: "2026-10-20T00:00:00Z" },
      { starts: "2026-11-01T00:00:00Z", ends: "2026-11-20T00:00:00Z" },
    ],
  });
  // 26 Oct falls in the pause, which a single 1 Oct – 20 Nov pair would have
  // treated as running.
  assert.deepEqual(giftLinesFrom([paused], basket, NONE, NOW, noCatalogue), []);
});

test("a window open at one end has no bound there", () => {
  const openEnded = spendPromo({ minSubtotal: 1000, windows: [{ starts: "2026-10-01T00:00:00Z" }] });
  assert.equal(giftLinesFrom([openEnded], basket, NONE, NOW, noCatalogue).length, 1);
  const alwaysUntil = spendPromo({ minSubtotal: 1000, windows: [{ ends: "2026-11-01T00:00:00Z" }] });
  assert.equal(giftLinesFrom([alwaysUntil], basket, NONE, NOW, noCatalogue).length, 1);
});

test("windows replace the single pair rather than adding to it", () => {
  // The pair says expired; the window says running. The window is the one
  // the operator edited, so it wins.
  const promo = spendPromo({
    minSubtotal: 1000,
    expires: "2026-10-01T00:00:00Z",
    windows: [{ starts: "2026-10-25T00:00:00Z", ends: "2026-10-28T00:00:00Z" }],
  });
  assert.equal(giftLinesFrom([promo], basket, NONE, NOW, noCatalogue).length, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BANDS,
  bandOf,
  drawFromBand,
  drawGiftExchange,
  drawLuckyFan,
  drawPhoneIn,
  GIFT_EXCHANGE,
  LUCKY_FAN_PRIZES,
  PHONE_IN_PRIZES,
  splitIntoBands,
  type Entrant,
  type Rng,
} from "./lucky-draw.ts";

// The real room, as it stood on 28 Oct 69: 8 people on 10 entries or more,
// 26 on 6 to 9, 138 on 1 to 5. The counts matter because the rule was
// written against them — eight gold seats, twelve silver and five open adds
// up to the twenty-five prizes only while the gold band is eight people.
const room = (gold: number, silver: number, open: number): Entrant[] => [
  ...Array.from({ length: gold }, (_, i) => ({ userId: `g${i}`, name: `gold ${i}`, entries: 10 + i })),
  ...Array.from({ length: silver }, (_, i) => ({ userId: `s${i}`, name: `silver ${i}`, entries: 6 + (i % 4) })),
  ...Array.from({ length: open }, (_, i) => ({ userId: `o${i}`, name: `open ${i}`, entries: 1 + (i % 5) })),
];

/** Always takes the first ticket in the bag, so a draw has one answer. */
const firstAlways: Rng = () => 0;

test("the bands are the ones the rule was written in", () => {
  assert.equal(bandOf(36), "gold");
  assert.equal(bandOf(10), "gold");
  assert.equal(bandOf(9), "silver");
  assert.equal(bandOf(6), "silver");
  assert.equal(bandOf(5), "open");
  assert.equal(bandOf(1), "open");
  // Nobody has none — an entry is what puts them in the room — but a zero
  // must not quietly land in a band and win something.
  assert.equal(bandOf(0), null);
});

test("every band is accounted for and nobody is in two", () => {
  const split = splitIntoBands(room(8, 26, 138));
  assert.equal(split.gold.length, 8);
  assert.equal(split.silver.length, 26);
  assert.equal(split.open.length, 138);
});

test("the real room: all 8 gold, 12 silver, 5 open", () => {
  const winners = drawLuckyFan(room(8, 26, 138), firstAlways);
  assert.equal(winners.length, LUCKY_FAN_PRIZES);
  const by = (band: string) => winners.filter((w) => w.band === band).length;
  assert.equal(by("gold"), 8);
  assert.equal(by("silver"), 12);
  assert.equal(by("open"), 5);
  // Drawn gold first, so the machine opens on the people who entered most.
  assert.equal(winners[0].band, "gold");
  assert.equal(winners[24].band, "open");
  // The order is what the screen counts up, not a gap-filled list.
  assert.deepEqual(
    winners.map((w) => w.order),
    Array.from({ length: 25 }, (_, i) => i + 1),
  );
});

test("nobody wins twice", () => {
  const winners = drawLuckyFan(room(8, 26, 138), () => Math.random());
  assert.equal(new Set(winners.map((w) => w.userId)).size, winners.length);
});

test("a short band hands its seats down rather than leaving prizes unawarded", () => {
  // Two in gold instead of eight: the six seats nobody took have to go
  // somewhere, or the campaign gives out 19 of the 25 prizes it announced.
  const winners = drawLuckyFan(room(2, 26, 138), firstAlways);
  assert.equal(winners.length, LUCKY_FAN_PRIZES);
  assert.equal(winners.filter((w) => w.band === "gold").length, 2);
});

test("a room smaller than the prize list gives everyone a prize and stops", () => {
  const winners = drawLuckyFan(room(1, 2, 3), firstAlways);
  assert.equal(winners.length, 6);
  assert.equal(new Set(winners.map((w) => w.userId)).size, 6);
});

test("a gold band bigger than the prize list does not spill into the others", () => {
  const winners = drawLuckyFan(room(30, 26, 138), firstAlways);
  assert.equal(winners.length, LUCKY_FAN_PRIZES);
  assert.ok(winners.every((w) => w.band === "gold"));
});

test("more entries wins more often", () => {
  // One person holds nine tickets against nine people holding one. Over
  // enough draws they come out first about half the time; the point of the
  // check is that the weighting is applied at all, so the bar is loose.
  const pool: Entrant[] = [
    { userId: "heavy", name: "heavy", entries: 9 },
    ...Array.from({ length: 9 }, (_, i) => ({ userId: `light${i}`, name: null, entries: 1 })),
  ];
  let heavyFirst = 0;
  for (let i = 0; i < 400; i++) {
    if (drawFromBand(pool, 1, () => Math.random())[0].userId === "heavy") heavyFirst++;
  }
  assert.ok(heavyFirst > 120, `heavy won first ${heavyFirst}/400 times`);
  assert.ok(heavyFirst < 320, `heavy won first ${heavyFirst}/400 times`);
});

test("asking for more than the band holds returns the band", () => {
  const band: Entrant[] = [{ userId: "a", name: null, entries: 3 }];
  assert.equal(drawFromBand(band, 10, firstAlways).length, 1);
});

test("the bands add up to the prize count on the poster", () => {
  const seated = BANDS.reduce((n, b) => n + (b.seats ?? 8), 0);
  assert.equal(seated, LUCKY_FAN_PRIZES);
});


// ---------------------------------------------------------------- phone in

test("phone in takes two from the middle band only", () => {
  const winners = drawPhoneIn(room(8, 26, 138), [], PHONE_IN_PRIZES, firstAlways);
  assert.equal(winners.length, 2);
  assert.ok(winners.every((w) => w.band === "silver"));
  assert.ok(winners.every((w) => w.entries >= 6 && w.entries <= 9));
});

test("phone in skips anybody who already has a prize", () => {
  const pool = room(8, 26, 138);
  const first = drawLuckyFan(pool, firstAlways);
  const won = new Set(first.map((w) => w.userId));
  const phone = drawPhoneIn(pool, won, PHONE_IN_PRIZES, firstAlways);
  assert.equal(phone.length, 2);
  assert.ok(phone.every((w) => !won.has(w.userId)));
});

test("phone in gives what it can when the band has run out", () => {
  // Two left in the band and both already hold a prize.
  const pool = room(0, 2, 10);
  const won = splitIntoBands(pool).silver.map((e) => e.userId);
  assert.equal(drawPhoneIn(pool, won, PHONE_IN_PRIZES, firstAlways).length, 0);
});

// ----------------------------------------------------------- gift exchange

const vipList = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ userId: `v${i}`, name: `vip ${i}`, entries: 1 }));

test("gift exchange draws ten from the VIP list: eight gifts and two lucky", () => {
  const winners = drawGiftExchange(vipList(21), [], GIFT_EXCHANGE, () => Math.random());
  assert.equal(winners.length, GIFT_EXCHANGE.vip + GIFT_EXCHANGE.lucky);
  assert.equal(winners.filter((w) => w.band === "gold").length, GIFT_EXCHANGE.vip);
  assert.equal(winners.filter((w) => w.band === "silver").length, GIFT_EXCHANGE.lucky);
});

test("nobody takes two of the ten", () => {
  for (let i = 0; i < 50; i++) {
    const winners = drawGiftExchange(vipList(21), [], GIFT_EXCHANGE, () => Math.random());
    assert.equal(new Set(winners.map((w) => w.userId)).size, winners.length);
  }
});

test("a VIP who has already been called is out", () => {
  const vips = vipList(21);
  const out = vips.slice(0, 13).map((v) => v.userId);
  const winners = drawGiftExchange(vips, out, GIFT_EXCHANGE, () => Math.random());
  // Eight left to draw ten from: everyone who is left, and no one who is not.
  assert.equal(winners.length, 8);
  assert.ok(winners.every((w) => !out.includes(w.userId)));
});

test("a VIP list shorter than the gifts hands out what there is", () => {
  const winners = drawGiftExchange(vipList(4), [], GIFT_EXCHANGE, firstAlways);
  assert.equal(winners.length, 4);
  assert.ok(winners.every((w) => w.band === "gold"));
});

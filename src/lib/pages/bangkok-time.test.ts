import { test } from "node:test";
import assert from "node:assert/strict";
import { bangkokInputToIso, isoToBangkokInput } from "./bangkok-time.ts";

// The seven-hour mistake, written down so it cannot be made again.

test("midnight in Bangkok is five in the afternoon the day before, in UTC", () => {
  assert.equal(bangkokInputToIso("2026-11-11T00:00"), "2026-11-10T17:00:00.000Z");
});

test("nine in the morning is two in the morning", () => {
  assert.equal(bangkokInputToIso("2026-11-11T09:00"), "2026-11-11T02:00:00.000Z");
});

test("what goes in comes back out unchanged", () => {
  for (const typed of ["2026-11-11T00:00", "2026-11-11T09:30", "2026-12-31T23:59", "2027-01-01T00:01"]) {
    const iso = bangkokInputToIso(typed);
    assert.ok(iso, `${typed} should parse`);
    assert.equal(isoToBangkokInput(iso), typed, `${typed} did not survive the round trip`);
  }
});

test("the browser's own timezone is not consulted", () => {
  // The whole point. Run under any TZ and the answer is the same, because an
  // admin answering email from Tokyo must not schedule a Thai campaign two
  // hours early.
  const before = process.env.TZ;
  try {
    for (const tz of ["UTC", "Asia/Tokyo", "America/New_York", "Asia/Bangkok"]) {
      process.env.TZ = tz;
      assert.equal(bangkokInputToIso("2026-11-11T00:00"), "2026-11-10T17:00:00.000Z", `wrong under ${tz}`);
    }
  } finally {
    process.env.TZ = before;
  }
});

test("seconds are accepted but not required", () => {
  assert.equal(bangkokInputToIso("2026-11-11T09:00:30"), "2026-11-11T02:00:30.000Z");
});

test("nothing typed is nothing stored, and nonsense is not a date", () => {
  assert.equal(bangkokInputToIso(""), null);
  assert.equal(bangkokInputToIso("   "), null);
  assert.equal(bangkokInputToIso("พรุ่งนี้เช้า"), null);
  assert.equal(bangkokInputToIso("2026-11-11"), null, "a date with no time is not an instant");
  assert.equal(isoToBangkokInput(null), "");
  assert.equal(isoToBangkokInput("ไม่ใช่เวลา"), "");
});

test("a date near the end of a month shifts the day as well as the hour", () => {
  // 2026-12-01T06:00 Bangkok is 2026-11-30T23:00 UTC — a different month.
  assert.equal(bangkokInputToIso("2026-12-01T06:00"), "2026-11-30T23:00:00.000Z");
  assert.equal(isoToBangkokInput("2026-11-30T23:00:00.000Z"), "2026-12-01T06:00");
});

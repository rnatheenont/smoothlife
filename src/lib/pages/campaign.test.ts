import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPhaseBoundaryAfter, validateCampaignTimes, PHASE_LABEL, PHASE_ORDER } from "./campaign.ts";
import { campaignPhaseAt } from "./doc.ts";

const T = {
  teaserAt: "2026-11-05T17:00:00.000Z", // 6 พ.ย. 00:00 ไทย
  liveAt: "2026-11-10T17:00:00.000Z", // 11 พ.ย. 00:00 ไทย
  extendedAt: "2026-11-11T17:00:00.000Z",
  endsAt: "2026-11-12T17:00:00.000Z",
};

test("the next boundary is the next date that has not passed", () => {
  assert.equal(nextPhaseBoundaryAfter(T, new Date("2026-11-01T00:00:00Z")), T.teaserAt);
  assert.equal(nextPhaseBoundaryAfter(T, new Date("2026-11-06T00:00:00Z")), T.liveAt);
  assert.equal(nextPhaseBoundaryAfter(T, new Date("2026-11-11T00:00:00Z")), T.extendedAt);
});

test("a boundary exactly now has passed — the phase already changed", () => {
  // campaignPhaseAt uses >=, so at the instant itself the page is already in
  // the new phase. If this returned the same instant the scheduler would
  // re-render that page every minute for ever.
  assert.equal(nextPhaseBoundaryAfter(T, new Date(T.liveAt)), T.extendedAt);
});

test("a campaign that is over has no next boundary", () => {
  assert.equal(nextPhaseBoundaryAfter(T, new Date("2026-12-01T00:00:00Z")), null);
  assert.equal(nextPhaseBoundaryAfter({}, new Date()), null);
});

test("dates that are not set are skipped, not treated as zero", () => {
  const noExtension = { liveAt: T.liveAt, endsAt: T.endsAt };
  assert.equal(nextPhaseBoundaryAfter(noExtension, new Date(T.liveAt)), T.endsAt);
  assert.equal(campaignPhaseAt(noExtension, new Date("2026-11-12T00:00:00Z")), "live");
});

test("dates in order pass; out of order is reported in Thai", () => {
  assert.deepEqual(validateCampaignTimes(T), []);
  const swapped = { ...T, extendedAt: T.liveAt, liveAt: T.extendedAt };
  const issues = validateCampaignTimes(swapped);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /ขยายเวลา ต้องอยู่หลัง วันงาน/);
});

test("two phases on the same instant is reported, because one gets skipped", () => {
  const issues = validateCampaignTimes({ ...T, extendedAt: T.liveAt });
  assert.equal(issues.length, 1);
  assert.match(issues[0], /ซ้ำเวลา/);
});

test("a half-filled campaign is not told off for the blanks", () => {
  assert.deepEqual(validateCampaignTimes({ liveAt: T.liveAt }), []);
  assert.deepEqual(validateCampaignTimes({ teaserAt: T.teaserAt, endsAt: T.endsAt }), []);
});

test("an unreadable date is reported, an empty one is not", () => {
  assert.deepEqual(validateCampaignTimes({ liveAt: "" }), []);
  assert.deepEqual(validateCampaignTimes({ liveAt: null }), []);
  const issues = validateCampaignTimes({ liveAt: "11 พฤศจิกายน" });
  assert.equal(issues.length, 1);
  assert.match(issues[0], /อ่านได้/);
});

test("every phase has a Thai label and appears once in the order", () => {
  assert.equal(PHASE_ORDER.length, 4);
  assert.equal(new Set(PHASE_ORDER).size, 4);
  for (const phase of PHASE_ORDER) assert.ok(PHASE_LABEL[phase]?.length > 0);
});

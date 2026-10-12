import { test } from "node:test";
import assert from "node:assert/strict";
import {
  campaignPhaseAt,
  isVisible,
  migrateDoc,
  nextBoundaryAfter,
  SCHEMA_VERSION,
  type PageDoc,
} from "./doc.ts";

// Run with: npm test
//
// These rules decide what a customer sees, on a page nobody will rebuild to
// fix. The cases that matter are the boundaries and the bad input, so that is
// what is written down here.

const section = (id: string, common?: Record<string, unknown>) => ({
  id,
  type: "rich_text",
  settings: {},
  ...(common ? { common } : {}),
});

const BKK = (iso: string) => new Date(iso);

test("a document that is not a document becomes an empty one, never an exception", () => {
  // The caller's next move is to fall back to the page built into the code.
  // Throwing here would take the home page down instead of replacing it.
  for (const bad of [null, undefined, 42, "a string", [], {}, { sections: [] }, { schemaVersion: 1 }]) {
    const doc = migrateDoc(bad);
    assert.equal(doc.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(doc.sections, []);
  }
});

test("sections missing an id or a type are dropped, the rest survive", () => {
  const doc = migrateDoc({
    schemaVersion: 1,
    sections: [section("a"), { type: "no_id", settings: {} }, { id: "no-type" }, null, section("b")],
  });
  assert.deepEqual(doc.sections.map((s) => s.id), ["a", "b"]);
});

test("no visibility rules means visible", () => {
  assert.equal(isVisible(undefined, new Date()), true);
  assert.equal(isVisible({}, new Date()), true);
});

test("hidden beats every other rule", () => {
  const common = { hidden: true, visibleFrom: "2020-01-01T00:00:00Z" };
  assert.equal(isVisible(common, BKK("2026-01-01T00:00:00Z")), false);
});

test("a window starts on its first instant and ends on its last", () => {
  const common = { visibleFrom: "2026-11-11T00:00:00Z", visibleUntil: "2026-11-12T00:00:00Z" };
  assert.equal(isVisible(common, BKK("2026-11-10T23:59:59Z")), false, "a second early");
  assert.equal(isVisible(common, BKK("2026-11-11T00:00:00Z")), true, "the first instant is in");
  assert.equal(isVisible(common, BKK("2026-11-11T23:59:59Z")), true, "a second before the end");
  // Exclusive end, so the section that takes over at midnight does not spend
  // one second on the page beside the one it replaces.
  assert.equal(isVisible(common, BKK("2026-11-12T00:00:00Z")), false, "the end instant is out");
});

test("a window written in Bangkok time is honoured as written", () => {
  // The server runs in UTC. A campaign that starts at midnight in Bangkok
  // starts at 17:00 UTC the day before, and the offset is where this kind of
  // thing goes wrong by seven hours.
  const common = { visibleFrom: "2026-11-11T00:00:00+07:00" };
  assert.equal(isVisible(common, BKK("2026-11-10T16:59:59Z")), false);
  assert.equal(isVisible(common, BKK("2026-11-10T17:00:00Z")), true);
});

test("an unreadable date is no bound at all, not a hidden section", () => {
  // One bad character typed into a form should not open a hole in the page
  // that nobody can explain.
  assert.equal(isVisible({ visibleFrom: "เมื่อวาน" }, new Date()), true);
  assert.equal(isVisible({ visibleUntil: "" }, new Date()), true);
});

test("phases only filter when the section names them", () => {
  const now = new Date();
  assert.equal(isVisible({}, now, "teaser"), true, "no phases means every phase");
  assert.equal(isVisible({ phases: [] }, now, "teaser"), true, "an empty list is not a filter");
  assert.equal(isVisible({ phases: ["live"] }, now, "live"), true);
  assert.equal(isVisible({ phases: ["live"] }, now, "teaser"), false);
  assert.equal(isVisible({ phases: ["live"] }, now), true, "no phase in context means not a campaign");
});

test("a campaign reads its phase from the end backwards", () => {
  const times = {
    teaserAt: "2026-11-01T00:00:00Z",
    liveAt: "2026-11-11T00:00:00Z",
    extendedAt: "2026-11-12T00:00:00Z",
    endsAt: "2026-11-13T00:00:00Z",
  };
  assert.equal(campaignPhaseAt(times, BKK("2026-10-31T23:59:59Z")), "teaser", "before the teaser there is nothing else to be");
  assert.equal(campaignPhaseAt(times, BKK("2026-11-05T00:00:00Z")), "teaser");
  assert.equal(campaignPhaseAt(times, BKK("2026-11-11T00:00:00Z")), "live", "on the instant, not after it");
  assert.equal(campaignPhaseAt(times, BKK("2026-11-12T06:00:00Z")), "extended");
  assert.equal(campaignPhaseAt(times, BKK("2026-11-13T00:00:00Z")), "ended");
});

test("a half-filled campaign schedule still answers", () => {
  const now = BKK("2026-11-11T00:00:00Z");
  assert.equal(campaignPhaseAt({}, now), "live", "no schedule means the page is simply on");
  assert.equal(campaignPhaseAt({ endsAt: "2026-11-01T00:00:00Z" }, now), "ended");
  assert.equal(campaignPhaseAt({ liveAt: "2026-12-01T00:00:00Z" }, now), "live", "nothing has started, and there is no teaser to be in");
  assert.equal(campaignPhaseAt({ teaserAt: "2026-12-01T00:00:00Z" }, now), "teaser");
  assert.equal(campaignPhaseAt({ endsAt: "ไม่รู้" }, now), "live", "an unreadable instant is no instant");
});

test("the next boundary is the soonest one still ahead", () => {
  const doc: PageDoc = {
    schemaVersion: 1,
    sections: [
      section("a", { visibleUntil: "2026-11-12T00:00:00Z" }),
      section("b", { visibleFrom: "2026-11-11T12:00:00Z" }),
      section("c", { visibleFrom: "2026-01-01T00:00:00Z" }),
      section("d"),
    ],
  };
  assert.equal(nextBoundaryAfter(doc, BKK("2026-11-11T00:00:00Z")), "2026-11-11T12:00:00.000Z");
  assert.equal(nextBoundaryAfter(doc, BKK("2026-11-11T13:00:00Z")), "2026-11-12T00:00:00.000Z");
  assert.equal(nextBoundaryAfter(doc, BKK("2026-12-01T00:00:00Z")), null, "nothing left to wait for");
});

test("a boundary exactly now has already happened", () => {
  // Otherwise the scheduler re-renders the same page every minute forever on
  // a boundary it has already crossed.
  const doc: PageDoc = { schemaVersion: 1, sections: [section("a", { visibleFrom: "2026-11-11T00:00:00Z" })] };
  assert.equal(nextBoundaryAfter(doc, BKK("2026-11-11T00:00:00Z")), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { announcementVisible, ANNOUNCEMENT_DEFAULT, type Announcement } from "./announcement.ts";

const bar = (over: Partial<Announcement> = {}): Announcement => ({
  ...ANNOUNCEMENT_DEFAULT,
  enabled: true,
  text: "ปิดรับออเดอร์ 31 ธ.ค.",
  ...over,
});

const at = (iso: string) => new Date(iso);

test("off by default — the shop has never had this bar", () => {
  assert.equal(announcementVisible(ANNOUNCEMENT_DEFAULT, at("2026-10-14T00:00:00Z")), false);
});

test("enabled with no window shows always", () => {
  assert.equal(announcementVisible(bar(), at("2026-01-01T00:00:00Z")), true);
});

test("a bar with no words is not a bar", () => {
  assert.equal(announcementVisible(bar({ text: "   " }), at("2026-10-14T00:00:00Z")), false);
});

test("written early, shown later", () => {
  const b = bar({ from: "2026-12-01T00:00:00Z" });
  assert.equal(announcementVisible(b, at("2026-11-30T23:59:00Z")), false);
  assert.equal(announcementVisible(b, at("2026-12-01T00:01:00Z")), true);
});

test("it stops on its own", () => {
  const b = bar({ until: "2026-12-31T17:00:00Z" });
  assert.equal(announcementVisible(b, at("2026-12-31T16:59:00Z")), true);
  assert.equal(announcementVisible(b, at("2026-12-31T17:01:00Z")), false);
});

test("a date nobody can parse is no bound, not a bar that never shows", () => {
  assert.equal(announcementVisible(bar({ from: "31 ธันวาคม" }), at("2026-10-14T00:00:00Z")), true);
  assert.equal(announcementVisible(bar({ until: "สิ้นปี" }), at("2026-10-14T00:00:00Z")), true);
});

test("turning it off beats any window", () => {
  assert.equal(announcementVisible(bar({ enabled: false, from: "2020-01-01T00:00:00Z" }), at("2026-10-14T00:00:00Z")), false);
});

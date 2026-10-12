import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addSection,
  moveSection,
  parseSlugList,
  removeSection,
  toggleHidden,
  updateSettings,
} from "./edit.ts";
import type { PageDoc } from "./doc.ts";

const doc = (...ids: string[]): PageDoc => ({
  schemaVersion: 1,
  sections: ids.map((id) => ({ id, type: "rich_text", settings: { title: id } })),
});

const ids = (d: PageDoc) => d.sections.map((s) => s.id);

test("moving swaps with the neighbour in that direction", () => {
  assert.deepEqual(ids(moveSection(doc("a", "b", "c"), "b", -1)), ["b", "a", "c"]);
  assert.deepEqual(ids(moveSection(doc("a", "b", "c"), "b", 1)), ["a", "c", "b"]);
});

test("moving off either end changes nothing and loses nothing", () => {
  // The bug this guards against is the one that wraps around, or worse, drops
  // the section on the way past the end.
  const three = doc("a", "b", "c");
  assert.deepEqual(ids(moveSection(three, "a", -1)), ["a", "b", "c"]);
  assert.deepEqual(ids(moveSection(three, "c", 1)), ["a", "b", "c"]);
  assert.deepEqual(ids(moveSection(three, "ไม่มีตัวนี้", 1)), ["a", "b", "c"]);
});

test("nothing is mutated — the editor compares old against new", () => {
  const before = doc("a", "b");
  const snapshot = ids(before).join(",");
  moveSection(before, "a", 1);
  toggleHidden(before, "a");
  removeSection(before, "a");
  addSection(before, { type: "x", version: 1, defaults: {} }, "new");
  updateSettings(before, "a", { title: "changed" });
  assert.equal(ids(before).join(","), snapshot);
  assert.deepEqual(before.sections[0].settings, { title: "a" });
});

test("hiding keeps the section and its settings", () => {
  const hidden = toggleHidden(doc("a", "b"), "a");
  assert.equal(hidden.sections.length, 2, "hiding is not deleting");
  assert.equal(hidden.sections[0].common?.hidden, true);
  assert.deepEqual(hidden.sections[0].settings, { title: "a" });
  // And back again.
  assert.equal(toggleHidden(hidden, "a").sections[0].common?.hidden, false);
});

test("hiding leaves other common settings alone", () => {
  const base: PageDoc = {
    schemaVersion: 1,
    sections: [{ id: "a", type: "rich_text", settings: {}, common: { visibleFrom: "2026-11-11T00:00:00Z" } }],
  };
  const hidden = toggleHidden(base, "a");
  assert.equal(hidden.sections[0].common?.visibleFrom, "2026-11-11T00:00:00Z");
  assert.equal(hidden.sections[0].common?.hidden, true);
});

test("removing takes exactly the one asked for", () => {
  assert.deepEqual(ids(removeSection(doc("a", "b", "c"), "b")), ["a", "c"]);
  assert.deepEqual(ids(removeSection(doc("a", "b"), "ไม่มีตัวนี้")), ["a", "b"]);
});

test("two sections of one type do not share a settings object", () => {
  // Sharing it would mean typing into one and watching the other change,
  // which is the kind of bug that gets reported as "the editor is haunted".
  const entry = { type: "promo", version: 1, defaults: { title: "เริ่มต้น", tags: ["a"] } };
  let d = addSection(doc(), entry, "one");
  d = addSection(d, entry, "two");
  d = updateSettings(d, "one", { title: "แก้แล้ว", tags: ["b"] });

  assert.deepEqual(d.sections[1].settings, { title: "เริ่มต้น", tags: ["a"] });
  assert.notEqual(d.sections[0].settings, d.sections[1].settings);
  // And neither of them is the defaults object the library handed over.
  assert.notEqual(d.sections[1].settings, entry.defaults);
  assert.deepEqual(entry.defaults, { title: "เริ่มต้น", tags: ["a"] });
});

test("a new section records the version its settings were written for", () => {
  const d = addSection(doc(), { type: "promo", version: 3, defaults: {} }, "x");
  assert.equal(d.sections[0].v, 3);
});

test("a slug list survives however it was typed", () => {
  assert.deepEqual(parseSlugList("smooth-e\neucerin\ncerave"), ["smooth-e", "eucerin", "cerave"]);
  assert.deepEqual(parseSlugList("smooth-e, eucerin ,cerave"), ["smooth-e", "eucerin", "cerave"]);
  assert.deepEqual(parseSlugList("smooth-e,\n  eucerin\n\n"), ["smooth-e", "eucerin"]);
  assert.deepEqual(parseSlugList("   "), [], "blank is an empty list, not a list with a blank in it");
  assert.deepEqual(parseSlugList(""), []);
});

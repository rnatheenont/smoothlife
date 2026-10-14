import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addSection,
  moveSection,
  parseSlugList,
  reorderSections,
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

test("dragging a section lands it at the index it was dropped on", () => {
  const d = doc("a", "b", "c", "d");
  // first to third: the ones it passed shift up, they do not swap
  assert.deepEqual(ids(reorderSections(d, 0, 2)), ["b", "c", "a", "d"]);
  // and back the other way
  assert.deepEqual(ids(reorderSections(d, 3, 0)), ["d", "a", "b", "c"]);
});

test("reordering is not swapping — the difference the arrows hide", () => {
  const d = doc("a", "b", "c", "d");
  // moveSection swaps with the neighbour; over one step the two agree
  assert.deepEqual(ids(reorderSections(d, 0, 1)), ids(moveSection(d, "a", 1)));
  // over three steps they do not, and reorder is the one a drag means
  assert.deepEqual(ids(reorderSections(d, 0, 3)), ["b", "c", "d", "a"]);
});

test("a drop that landed nowhere changes nothing", () => {
  const d = doc("a", "b", "c");
  for (const [from, to] of [[-1, 1], [1, -1], [0, 9], [9, 0], [1, 1]] as const) {
    assert.deepEqual(ids(reorderSections(d, from, to)), ["a", "b", "c"]);
  }
});

// Locked and pinned sections.
//
// The rules are passed in as literals here, which is the point of taking
// them as predicates: these run without the registry, so without React and
// without a single section component being imported.

/** A page whose first section is a pinned breadcrumb and whose "listing" is
 *  the locked machinery of /shop. */
const shopDoc = (): PageDoc => ({
  schemaVersion: 1,
  sections: [
    { id: "crumb", type: "breadcrumb", settings: {} },
    { id: "intro", type: "rich_text", settings: {} },
    { id: "listing", type: "shop_listing", settings: {} },
    { id: "foot", type: "cta_card", settings: {} },
  ],
});

const rules = {
  isLocked: (type: string) => type === "shop_listing",
  pinnedOf: (type: string) => (type === "breadcrumb" ? ("top" as const) : undefined),
};

test("a locked section cannot be deleted", () => {
  const d = shopDoc();
  assert.equal(removeSection(d, "listing", rules), d);
  assert.deepEqual(ids(removeSection(d, "intro", rules)), ["crumb", "listing", "foot"]);
});

test("a locked section cannot be hidden — the page stops working without it", () => {
  const d = shopDoc();
  assert.equal(toggleHidden(d, "listing", rules), d);
  assert.equal(toggleHidden(d, "intro", rules).sections[1].common?.hidden, true);
});

test("a locked section still moves — where the machinery sits is a layout choice", () => {
  assert.deepEqual(ids(reorderSections(shopDoc(), 2, 1, rules)), ["crumb", "listing", "intro", "foot"]);
});

test("a pinned section does not travel", () => {
  const d = shopDoc();
  assert.equal(reorderSections(d, 0, 2, rules), d);
  assert.equal(moveSection(d, "crumb", 1, rules), d);
});

test("nothing is dropped above a section pinned to the top", () => {
  const d = shopDoc();
  assert.equal(reorderSections(d, 2, 0, rules), d);
  assert.equal(moveSection(d, "intro", -1, rules), d);
});

test("a section pinned to the bottom holds the foot of the page", () => {
  const d: PageDoc = {
    schemaVersion: 1,
    sections: [
      { id: "a", type: "rich_text", settings: {} },
      { id: "b", type: "rich_text", settings: {} },
      { id: "legal", type: "campaign_terms", settings: {} },
    ],
  };
  const r = { pinnedOf: (t: string) => (t === "campaign_terms" ? ("bottom" as const) : undefined) };
  assert.equal(reorderSections(d, 0, 2, r), d);
  assert.deepEqual(ids(reorderSections(d, 0, 1, r)), ["b", "a", "legal"]);
});

test("without rules a document behaves exactly as it did before locking existed", () => {
  const d = shopDoc();
  assert.deepEqual(ids(removeSection(d, "listing")), ["crumb", "intro", "foot"]);
  assert.deepEqual(ids(reorderSections(d, 0, 3)), ["intro", "listing", "foot", "crumb"]);
});

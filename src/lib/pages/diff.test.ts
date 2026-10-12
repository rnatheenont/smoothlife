import { test } from "node:test";
import assert from "node:assert/strict";
import { diffDocs } from "./diff.ts";
import type { PageDoc, SectionInstance } from "./doc.ts";

const sec = (id: string, settings: Record<string, unknown> = {}, common?: SectionInstance["common"]): SectionInstance => ({
  id,
  type: "rich_text",
  settings,
  ...(common ? { common } : {}),
});

const docOf = (...sections: SectionInstance[]): PageDoc => ({ schemaVersion: 1, sections });

test("two identical documents differ in nothing", () => {
  const d = docOf(sec("a", { heading: "x" }), sec("b"));
  const diff = diffDocs(d, docOf(sec("a", { heading: "x" }), sec("b")));
  assert.equal(diff.same, true);
  assert.deepEqual([diff.added, diff.removed, diff.moved, diff.changed], [[], [], [], []]);
});

test("key order in settings is not a change", () => {
  const before = docOf(sec("a", { heading: "x", body: "y" }));
  const after = docOf(sec("a", { body: "y", heading: "x" }));
  assert.equal(diffDocs(before, after).same, true);
});

test("added and removed are reported by id", () => {
  const diff = diffDocs(docOf(sec("a"), sec("b")), docOf(sec("b"), sec("c")));
  assert.deepEqual(diff.added.map((s) => s.id), ["c"]);
  assert.deepEqual(diff.removed.map((s) => s.id), ["a"]);
});

test("adding at the top does not report everything else as moved", () => {
  // The trap this exists for: absolute indexes all shift by one, and a diff
  // that read them would say the whole page moved.
  const before = docOf(sec("a"), sec("b"), sec("c"));
  const after = docOf(sec("new"), sec("a"), sec("b"), sec("c"));
  const diff = diffDocs(before, after);
  assert.deepEqual(diff.added.map((s) => s.id), ["new"]);
  assert.deepEqual(diff.moved, []);
});

test("a real reorder is reported, with where it went", () => {
  const diff = diffDocs(docOf(sec("a"), sec("b"), sec("c")), docOf(sec("b"), sec("c"), sec("a")));
  assert.deepEqual(
    diff.moved.map((m) => `${m.id}:${m.from}->${m.to}`).sort(),
    ["a:0->2", "b:1->0", "c:2->1"]
  );
});

test("changed settings name the keys that changed, and only those", () => {
  const before = docOf(sec("a", { heading: "เดิม", body: "เหมือนเดิม", align: "left" }));
  const after = docOf(sec("a", { heading: "ใหม่", body: "เหมือนเดิม", align: "center" }));
  const diff = diffDocs(before, after);
  assert.equal(diff.changed.length, 1);
  assert.deepEqual(diff.changed[0].keys, ["align", "heading"]);
  assert.deepEqual(diff.changed[0].common, []);
});

test("hiding or scheduling a section is a change too", () => {
  const before = docOf(sec("a", {}, { hidden: false }));
  const after = docOf(sec("a", {}, { hidden: true, visibleFrom: "2026-11-11T00:00:00Z" }));
  const diff = diffDocs(before, after);
  assert.deepEqual(diff.changed[0].common, ["hidden", "visibleFrom"]);
  assert.deepEqual(diff.changed[0].keys, []);
});

test("a section that was both moved and edited appears in both lists", () => {
  const before = docOf(sec("a", { heading: "x" }), sec("b"));
  const after = docOf(sec("b"), sec("a", { heading: "y" }));
  const diff = diffDocs(before, after);
  assert.deepEqual(diff.moved.map((m) => m.id).sort(), ["a", "b"]);
  assert.deepEqual(diff.changed.map((c) => c.id), ["a"]);
  assert.equal(diff.same, false);
});

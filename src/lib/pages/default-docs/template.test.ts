import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATE_DEFAULT_DOCS } from "./template.ts";
import { TEMPLATES } from "../system-pages.ts";

// A template document is every page it draws, so the checks that matter here
// are the ones a single page would forgive and hundreds would not.

test("every template document belongs to a template in the registry", () => {
  for (const key of Object.keys(TEMPLATE_DEFAULT_DOCS)) {
    assert.ok(TEMPLATES[key], `มีเอกสารตั้งต้นของเทมเพลต "${key}" แต่ไม่มีในทะเบียน`);
  }
});

/** The sections that draw a template page's h1 — the item's own name. */
const H1_SECTIONS = new Set(["entity_header", "page_header", "collection_header", "category_header"]);

test("each template owns exactly one h1", () => {
  for (const [key, make] of Object.entries(TEMPLATE_DEFAULT_DOCS)) {
    const headers = make().sections.filter((s) => H1_SECTIONS.has(s.type));
    assert.equal(headers.length, 1, `เทมเพลต "${key}" มี section ที่เป็นเจ้าของ h1 ${headers.length} อัน`);
  }
});

test("every section carries an id, and no two share one", () => {
  for (const [key, make] of Object.entries(TEMPLATE_DEFAULT_DOCS)) {
    const ids = make().sections.map((s) => s.id);
    assert.ok(ids.every(Boolean), `เทมเพลต "${key}" มี section ที่ไม่มี id`);
    assert.equal(new Set(ids).size, ids.length, `เทมเพลต "${key}" มี id ซ้ำ`);
  }
});

test("two calls give two documents, not one shared object", () => {
  const a = TEMPLATE_DEFAULT_DOCS.concern();
  const b = TEMPLATE_DEFAULT_DOCS.concern();
  assert.notEqual(a, b);
  assert.notEqual(a.sections[0], b.sections[0]);
  assert.deepEqual(a, b);
});

test("the templates written so far", () => {
  // A list rather than a count, so adding a template is a deliberate edit
  // here too — one publish of one of these changes hundreds of pages.
  assert.deepEqual(Object.keys(TEMPLATE_DEFAULT_DOCS).sort(), ["category", "collection", "concern"]);
});

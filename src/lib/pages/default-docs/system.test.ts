import { test } from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_DEFAULT_DOCS } from "./system.ts";
import { SYSTEM_PAGES } from "../system-pages.ts";

// These documents are the pages themselves. The checks here are the ones that
// would otherwise be found by looking at the live site: a document filed under
// a page that does not exist, a page with two <h1>s or none, a section with no
// id to point a preview click at.

test("every default document belongs to a page in the registry", () => {
  for (const key of Object.keys(SYSTEM_DEFAULT_DOCS)) {
    assert.ok(SYSTEM_PAGES[key], `มีเอกสารตั้งต้นของ "${key}" แต่ไม่มีหน้านี้ในทะเบียน`);
  }
});

/** The sections that draw a page's h1. Most pages use page_header; a couple
 *  are one locked block that owns its own heading because the heading and
 *  the block are one layout. */
const H1_SECTIONS = new Set([
  "page_header",
  "tier_cards",
  "page_state",
  // The two pages that are one application: the brand directory and the
  // search page each draw their own heading, because the heading is part of
  // the state the thing is in.
  "brand_directory",
  "search_app",
  // The cart draws its own "ตะกร้าสินค้า" heading as the page's h1.
  "cart_app",
  // Each account page draws its own heading inside AccountLayout.
  "account_referral",
  "account_points",
  // /shop's banner draws the h1 and changes it with the category being
  // browsed, so the words cannot live in a header block above it.
  "shop_hero",
]);

test("each page owns exactly one h1", () => {
  for (const [key, make] of Object.entries(SYSTEM_DEFAULT_DOCS)) {
    const headers = make().sections.filter((s) => H1_SECTIONS.has(s.type));
    assert.equal(headers.length, 1, `"${key}" มี section ที่เป็นเจ้าของ h1 ${headers.length} อัน`);
  }
});

test("every section carries an id, and no two share one", () => {
  for (const [key, make] of Object.entries(SYSTEM_DEFAULT_DOCS)) {
    const ids = make().sections.map((s) => s.id);
    assert.ok(ids.every(Boolean), `"${key}" มี section ที่ไม่มี id`);
    assert.equal(new Set(ids).size, ids.length, `"${key}" มี id ซ้ำ`);
  }
});

test("two calls give two documents, not one shared object", () => {
  // The editor edits what it is given. A default that handed out the same
  // object every time would let one page's edits appear on another.
  const a = SYSTEM_DEFAULT_DOCS.about();
  const b = SYSTEM_DEFAULT_DOCS.about();
  assert.notEqual(a, b);
  assert.notEqual(a.sections[0], b.sections[0]);
  assert.deepEqual(a, b);
});

test("the pages written so far", () => {
  // A list rather than a count, so adding a page is a deliberate edit here
  // too — this file is the only place that says which pages have been
  // checked against the originals.
  assert.deepEqual(Object.keys(SYSTEM_DEFAULT_DOCS).sort(), [
    "about",
    "about-experts",
    "about-quality",
    "about-sustainability",
    "account-points",
    "account-referral",
    "ai-assistant",
    "brands",
    "cart",
    "collections",
    "concern-hub",
    "help",
    "help-delivery",
    "help-payment",
    "knowledge",
    "knowledge-ingredients",
    "knowledge-routines",
    "knowledge-videos",
    "loyalty",
    "not-found",
    "offline",
    "privacy",
    "promotions",
    "questions",
    "search",
    "shop",
    "stores",
    "terms",
  ]);
});

test("a legal page keeps every clause of the page it replaces", () => {
  // Counted rather than eyeballed: these documents were generated from the
  // hand-written pages, and the failure mode of that is a clause lost in
  // transit, which nobody notices until somebody needs that clause.
  const headings = (key: string) =>
    (SYSTEM_DEFAULT_DOCS[key]().sections[1].settings as { body: string }).body.match(/^## /gm) ?? [];
  assert.equal(headings("privacy").length, 6);
  assert.equal(headings("terms").length, 7);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { headerLinksSchema, HEADER_LINKS_DEFAULT, usableHeaderLinks } from "./header-links.ts";

// The dropdown that edits "opens the mega menu" hands back a string, and a
// document written before that dropdown existed holds a boolean. Both have
// to parse, because a list that fails to parse falls back to the built-in
// header and the page still looks right — so nobody finds out.

test('mega accepts the dropdown\'s "true" and a stored boolean alike', () => {
  const fromForm = headerLinksSchema.safeParse({
    desk: [{ href: "/brands", th: "แบรนด์", en: "Brands", mega: "true" }],
    deskUtility: [],
    drawer: [],
  });
  assert.equal(fromForm.success, true);
  assert.equal(fromForm.success && fromForm.data.desk[0].mega, true);

  const fromDoc = headerLinksSchema.safeParse({
    desk: [{ href: "/brands", th: "แบรนด์", en: "Brands", mega: true }],
    deskUtility: [],
    drawer: [],
  });
  assert.equal(fromDoc.success && fromDoc.data.desk[0].mega, true);
});

test('"" from the dropdown means not a mega link', () => {
  const parsed = headerLinksSchema.safeParse({
    desk: [{ href: "/shop", th: "ช้อป", en: "Shop", mega: "" }],
    deskUtility: [],
    drawer: [],
  });
  assert.equal(parsed.success && parsed.data.desk[0].mega, false);
});

test("the built-in lists parse as they are", () => {
  assert.equal(headerLinksSchema.safeParse(HEADER_LINKS_DEFAULT).success, true);
});

test("a broken drawer does not take the top bar down with it", () => {
  const kept = usableHeaderLinks({ ...HEADER_LINKS_DEFAULT, drawer: [] });
  assert.equal(kept.desk.length, HEADER_LINKS_DEFAULT.desk.length);
  assert.equal(kept.drawer.length, HEADER_LINKS_DEFAULT.drawer.length);
});

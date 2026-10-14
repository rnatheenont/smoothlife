import { test } from "node:test";
import assert from "node:assert/strict";
import { usableTabs, MOBILE_TABS_DEFAULT, type MobileTab } from "./mobile-tabs.ts";

const tab = (over: Partial<MobileTab> = {}): MobileTab => ({
  icon: "home",
  href: "/",
  th: "หน้าแรก",
  en: "Home",
  ...over,
});

test("the five the shop ships with are usable as they are", () => {
  assert.deepEqual(usableTabs(MOBILE_TABS_DEFAULT), MOBILE_TABS_DEFAULT);
});

test("a tab with nowhere to go is dropped", () => {
  const tabs = [tab(), tab({ href: "" }), tab({ href: "/shop" }), tab({ href: "/cart" })];
  assert.equal(usableTabs(tabs).length, 3);
});

test("fewer than three is not a navigation bar — the built-in ones come back", () => {
  assert.deepEqual(usableTabs([tab(), tab({ href: "/shop" })]), MOBILE_TABS_DEFAULT);
  assert.deepEqual(usableTabs([]), MOBILE_TABS_DEFAULT);
});

test("a sixth tab is not drawn — five thumb targets is the design", () => {
  const six = Array.from({ length: 6 }, (_, i) => tab({ href: `/p${i}` }));
  assert.equal(usableTabs(six).length, 5);
});

test("a tab with no label is a gap, not a tab", () => {
  const tabs = [tab(), tab({ th: "" }), tab({ href: "/shop" }), tab({ href: "/cart" })];
  assert.equal(usableTabs(tabs).length, 3);
});

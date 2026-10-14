import { test } from "node:test";
import assert from "node:assert/strict";
import { crumbsFor } from "./trail.ts";

const at = (kind: "system" | "template" | "home", slug: string, entity?: Parameters<typeof crumbsFor>[0]["entity"]) =>
  crumbsFor({ kind, slug, entity });

test("a page one level down names itself and nothing else", () => {
  assert.deepEqual(at("system", "about"), [{ label: "เกี่ยวกับเรา" }]);
});

test("a page two levels down walks the page above it, as a link", () => {
  assert.deepEqual(at("system", "help-delivery"), [
    { label: "ศูนย์ช่วยเหลือ", href: "/help" },
    { label: "การจัดส่ง" },
  ]);
});

test("the last step is never a link — you are already there", () => {
  const trail = at("system", "about-quality");
  assert.equal(trail[trail.length - 1].href, undefined);
});

test("a step no page serves is skipped rather than guessed at", () => {
  // /knowledge/questions exists; its parent /knowledge does too, so this is
  // the shape of a trail that walks a real tree.
  assert.deepEqual(at("system", "questions"), [
    { label: "ความรู้", href: "/knowledge" },
    { label: "คำถามที่พบบ่อย" },
  ]);
});

test("a template's trail stops at its hub, because the item has no name here", () => {
  assert.deepEqual(at("template", "product", { type: "product", slug: "anything" }), [
    { label: "ช้อปทั้งหมด", href: "/shop" },
  ]);
  assert.deepEqual(at("template", "article", { type: "article", handle: "x" }), [
    { label: "ความรู้", href: "/knowledge" },
  ]);
});

test("pages outside the registry have no trail at all", () => {
  assert.deepEqual(at("system", "not-a-page"), []);
  assert.deepEqual(at("home", "home"), []);
  // The 404 has no address, so there is nowhere to say it sits.
  assert.deepEqual(at("system", "not-found"), []);
});

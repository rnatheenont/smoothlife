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
  // "ความรู้เรื่องผิวและสุขภาพ" rather than the admin list's "ความรู้": the
  // registry entry carries a longer name for the trail, which is what this
  // page's hand-written BreadcrumbList said before it moved into the system.
  assert.deepEqual(at("system", "questions"), [
    { label: "ความรู้เรื่องผิวและสุขภาพ", href: "/knowledge" },
    { label: "คำถามที่พบบ่อย" },
  ]);
});

test("a template's trail is its hub and then the item", () => {
  assert.deepEqual(at("template", "product", { type: "product", slug: "anything", name: "เซรั่ม" }), [
    { label: "ช้อป", href: "/shop" },
    { label: "เซรั่ม" },
  ]);
  assert.deepEqual(at("template", "article", { type: "article", handle: "x", name: "ไนอาซินาไมด์" }), [
    { label: "ความรู้เรื่องผิวและสุขภาพ", href: "/knowledge" },
    { label: "ไนอาซินาไมด์" },
  ]);
});

test("an item with no name gives the hub alone, not a trail ending in a blank", () => {
  assert.deepEqual(at("template", "concern", { type: "concern", slug: "acne", name: "" }), [
    { label: "ปัญหาผิวที่กังวล", href: "/concern" },
  ]);
});

test("pages outside the registry have no trail at all", () => {
  assert.deepEqual(at("system", "not-a-page"), []);
  assert.deepEqual(at("home", "home"), []);
  // The 404 has no address, so there is nowhere to say it sits.
  assert.deepEqual(at("system", "not-found"), []);
});

test("a hub that is itself nested contributes both of its steps", () => {
  // /knowledge/questions sits under /knowledge, so a question's trail walks
  // the hub's whole address rather than jumping straight to it. This is what
  // the hand-written question page declared before it moved into the system.
  assert.deepEqual(at("template", "question", { type: "question", slug: "x", name: "ล้างหน้าวันละกี่ครั้ง" }), [
    { label: "ความรู้เรื่องผิวและสุขภาพ", href: "/knowledge" },
    { label: "คำถามที่พบบ่อย", href: "/knowledge/questions" },
    { label: "ล้างหน้าวันละกี่ครั้ง" },
  ]);
});

test("an item can say what it sits under, between the hub and itself", () => {
  // A product's category is a fact about the product, not about the registry.
  assert.deepEqual(
    at("template", "product", {
      type: "product",
      slug: "x",
      name: "Smooth E Baby Face Foam",
      under: [{ label: "สกินแคร์", href: "/shop/skincare" }],
    }),
    [
      { label: "ช้อป", href: "/shop" },
      { label: "สกินแคร์", href: "/shop/skincare" },
      { label: "Smooth E Baby Face Foam" },
    ]
  );
});

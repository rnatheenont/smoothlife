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
  // An article lives at /knowledge/article/<slug>, and /knowledge/article is
  // not a page anybody can open — so the trail skips it and names the hub
  // above it rather than inventing a link that 404s.
  //
  // This used to use /knowledge/questions, which skipped nothing: both it and
  // /knowledge were real pages, so the test's name described a case it was
  // not exercising. The FAQ centre's move to /faq is what surfaced that.
  // "ความรู้เรื่องผิวและสุขภาพ" rather than the admin list's "ความรู้": the
  // registry entry carries a longer name for the trail.
  assert.deepEqual(at("template", "article", { type: "article", handle: "x", name: "ชื่อบทความ" }), [
    { label: "ความรู้เรื่องผิวและสุขภาพ", href: "/knowledge" },
    { label: "ชื่อบทความ" },
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

test("a question's trail is its hub, then the question", () => {
  // The FAQ centre is a destination of its own at /faq, not a shelf inside
  // /knowledge, so a question sits one step below the top.
  //
  // This test used to assert three steps, because the hub was then at
  // /knowledge/questions and contributed two. No template sits under a nested
  // hub any more, so that composition has no real page left to check; a page
  // two levels down is still covered above by /help/delivery, and an ancestor
  // with no page of its own by the article template.
  assert.deepEqual(at("template", "question", { type: "question", slug: "x", name: "ล้างหน้าวันละกี่ครั้ง" }), [
    { label: "คำถามที่พบบ่อย", href: "/faq" },
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

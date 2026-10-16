import { test } from "node:test";
import assert from "node:assert/strict";
import { tx, thaiOf, hasTranslation, splitLText, joinLText, DEFAULT_LOCALE, LOCALES } from "./localized.ts";

// What these tests are really protecting is every document written before
// today: all of them store plain strings, and all of them are Thai.

test("a plain string is Thai, in both languages", () => {
  assert.equal(tx("ลดสูงสุด 70%", "th"), "ลดสูงสุด 70%");
  // English has nothing of its own yet, so it shows the Thai rather than
  // a blank where a promise was.
  assert.equal(tx("ลดสูงสุด 70%", "en"), "ลดสูงสุด 70%");
});

test("a pair reads the language asked for", () => {
  const v = { th: "ลดสูงสุด 70%", en: "Up to 70% off" };
  assert.equal(tx(v, "th"), "ลดสูงสุด 70%");
  assert.equal(tx(v, "en"), "Up to 70% off");
});

test("English falls back to Thai when it is missing or only spaces", () => {
  assert.equal(tx({ th: "ส่งฟรี" }, "en"), "ส่งฟรี");
  assert.equal(tx({ th: "ส่งฟรี", en: "" }, "en"), "ส่งฟรี");
  assert.equal(tx({ th: "ส่งฟรี", en: "   " }, "en"), "ส่งฟรี");
});

test("nothing at all is an empty string, never undefined", () => {
  // Components interpolate this straight into JSX; "undefined" printed on a
  // product page is worse than nothing printed.
  assert.equal(tx(undefined, "th"), "");
  assert.equal(tx(null, "en"), "");
});

test("hasTranslation says whether this language has words of its own", () => {
  assert.equal(hasTranslation("ส่งฟรี", "th"), true);
  assert.equal(hasTranslation("ส่งฟรี", "en"), false);
  assert.equal(hasTranslation({ th: "ส่งฟรี" }, "en"), false);
  assert.equal(hasTranslation({ th: "ส่งฟรี", en: " " }, "en"), false);
  assert.equal(hasTranslation({ th: "ส่งฟรี", en: "Free shipping" }, "en"), true);
});

test("thaiOf gets the Thai side whatever shape the value is", () => {
  assert.equal(thaiOf("ส่งฟรี"), "ส่งฟรี");
  assert.equal(thaiOf({ th: "ส่งฟรี", en: "Free shipping" }), "ส่งฟรี");
  assert.equal(thaiOf(undefined), "");
});

test("Thai is the default and both languages are listed", () => {
  assert.equal(DEFAULT_LOCALE, "th");
  assert.deepEqual(LOCALES, ["th", "en"]);
});

test("splitLText reads an old plain string as Thai with no English yet", () => {
  assert.deepEqual(splitLText("ส่งฟรี"), { th: "ส่งฟรี", en: "" });
  assert.deepEqual(splitLText({ th: "ส่งฟรี", en: "Free shipping" }), { th: "ส่งฟรี", en: "Free shipping" });
  assert.deepEqual(splitLText(undefined), { th: "", en: "" });
  // A number or a nested object is not text; the boxes start empty rather
  // than showing "[object Object]" for somebody to save back.
  assert.deepEqual(splitLText(42), { th: "", en: "" });
  assert.deepEqual(splitLText({ th: { nope: 1 } }), { th: "", en: "" });
});

test("joinLText stays a plain string until there is a real translation", () => {
  assert.equal(joinLText("ส่งฟรี", ""), "ส่งฟรี");
  assert.equal(joinLText("ส่งฟรี", "   "), "ส่งฟรี");
  assert.deepEqual(joinLText("ส่งฟรี", "Free shipping"), { th: "ส่งฟรี", en: "Free shipping" });
});

test("a value survives a round trip through the editor unchanged", () => {
  for (const original of ["ส่งฟรี", "", { th: "ส่งฟรี", en: "Free shipping" }] as const) {
    const { th, en } = splitLText(original);
    assert.deepEqual(joinLText(th, en), original);
  }
});

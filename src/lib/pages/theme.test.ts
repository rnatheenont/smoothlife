import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkTheme,
  contrastRatio,
  MIN_CONTRAST,
  onAccentFor,
  parseHex,
  relativeLuminance,
  themeVars,
  ON_ACCENT_DARK,
  ON_ACCENT_LIGHT,
} from "./theme.ts";

test("hex comes in three shapes and only three", () => {
  assert.deepEqual(parseHex("#E0245E"), { r: 224, g: 36, b: 94 });
  assert.deepEqual(parseHex("e0245e"), { r: 224, g: 36, b: 94 });
  assert.deepEqual(parseHex("#f0a"), { r: 255, g: 0, b: 170 });
  for (const bad of ["", "#", "#12345", "red", "rgb(1,2,3)", "#gggggg", null, undefined, 123 as never]) {
    assert.equal(parseHex(bad as string), null, `${String(bad)} should not parse`);
  }
});

test("the two ends of the luminance scale are exactly 0 and 1", () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
});

test("black on white is 21:1 — the known anchor for the whole formula", () => {
  const ratio = contrastRatio("#000000", "#FFFFFF");
  assert.ok(ratio !== null && Math.abs(ratio - 21) < 0.01, `got ${ratio}`);
  assert.equal(contrastRatio("#FFF", "#FFFFFF"), 1);
  assert.equal(contrastRatio("nope", "#FFFFFF"), null);
});

test("text colour is picked, and it is the one with more contrast", () => {
  // Yellow needs dark text; navy needs light text. Anyone who has seen white
  // on yellow knows which way round this has to come out.
  assert.equal(onAccentFor("#FFE800")?.color, ON_ACCENT_DARK);
  assert.equal(onAccentFor("#10243B")?.color, ON_ACCENT_LIGHT);
  assert.equal(onAccentFor("not-a-colour"), null);
});

test("a mid-tone accent that cannot carry either text colour is blocked", () => {
  // The trap this check exists for: a colour that looks strong and fails
  // both ways. Mid grey is the clearest example.
  const best = onAccentFor("#808080");
  assert.ok(best !== null && best.ratio < MIN_CONTRAST, `got ${best?.ratio}`);
  const issues = checkTheme({ accent: "#808080" });
  assert.equal(issues.length, 1);
  assert.match(issues[0], /contrast/);
  // The measured number is in the message, so there is something to aim at.
  assert.match(issues[0], /\d\.\d:1/);
});

test("an accent that passes raises nothing", () => {
  assert.deepEqual(checkTheme({ accent: "#A3123F", background: "#FFF7F9", badgeText: "11.11" }), []);
});

test("no theme and an empty theme are both fine", () => {
  assert.deepEqual(checkTheme(null), []);
  assert.deepEqual(checkTheme(undefined), []);
  assert.deepEqual(checkTheme({}), []);
});

test("an unreadable colour is reported as a typo, not as bad contrast", () => {
  const issues = checkTheme({ accent: "#ZZZ111", background: "สีชมพู" });
  assert.equal(issues.length, 2);
  assert.match(issues[0], /ไม่ใช่รหัสสีที่อ่านได้/);
  assert.match(issues[1], /ไม่ใช่รหัสสีที่อ่านได้/);
});

test("a badge long enough to wrap is reported", () => {
  assert.deepEqual(checkTheme({ badgeText: "ลด 50%" }), []);
  assert.equal(checkTheme({ badgeText: "ลดกระหน่ำทั้งร้านวันนี้เท่านั้น" }).length, 1);
});

test("only colours that were readable become variables", () => {
  assert.deepEqual(themeVars({ accent: "#10243B", background: "#FFFFFF" }), {
    "--cp-accent": "#10243B",
    "--cp-on-accent": ON_ACCENT_LIGHT,
    "--cp-bg": "#FFFFFF",
  });
  // One typo must not take the rest of the theme with it.
  assert.deepEqual(themeVars({ accent: "oops", background: "#FFFFFF" }), { "--cp-bg": "#FFFFFF" });
  assert.deepEqual(themeVars(null), {});
});

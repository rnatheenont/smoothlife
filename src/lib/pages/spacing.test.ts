import { test } from "node:test";
import assert from "node:assert/strict";
import { spacingClass, SPACE_OPTIONS } from "./spacing.ts";

test("a section nobody has adjusted gets no classes at all", () => {
  assert.equal(spacingClass(undefined), "");
  assert.equal(spacingClass({}), "");
  assert.equal(spacingClass({ space: {} }), "");
});

test('"ปกติ" is the same as not set — it must not add a class', () => {
  assert.equal(spacingClass({ space: { top: "0", bottom: "0" } }), "");
});

test("one end can be adjusted without the other", () => {
  assert.equal(spacingClass({ space: { top: "1" } }), "mt-2");
  assert.equal(spacingClass({ space: { bottom: "-1" } }), "-mb-2");
});

test("both ends together", () => {
  assert.equal(spacingClass({ space: { top: "-2", bottom: "2" } }), "-mt-4 mb-4");
});

test("every option the editor offers produces a class, except ปกติ", () => {
  for (const [step] of SPACE_OPTIONS) {
    const cls = spacingClass({ space: { top: step } });
    if (step === "0") assert.equal(cls, "");
    else assert.match(cls, /^-?mt-\d$/, `step ${step} ไม่ได้คลาส`);
  }
});

test("hidden and the schedule are untouched by spacing", () => {
  assert.equal(spacingClass({ hidden: true, visibleFrom: "2026-01-01" }), "");
});

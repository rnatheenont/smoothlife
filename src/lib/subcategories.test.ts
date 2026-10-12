import { test } from "node:test";
import assert from "node:assert/strict";
import { guessSubcategory, subcategoriesOf, subcategoryLabel, SUBCATEGORIES } from "./subcategories.ts";

// Every case below is a real product from the catalogue that the first draft
// of these rules filed on the wrong shelf. They are here so the next edit to
// a regex has to notice.

const guess = (name: string, category: string, shortDesc = "") =>
  guessSubcategory({ name, category, shortDesc });

test("the obvious cases land where you would expect", () => {
  assert.equal(guess("CERAVE Resurfacing Retinol Serum เรตินอลเซรั่ม 30ml.", "skincare"), "serum");
  assert.equal(guess("Dentiste Anticavity Max Fluoride Toothpaste 100G.", "oral-care"), "toothpaste");
  assert.equal(guess("AROMASE Anti-hair Loss Essential Shampoo 400 ml.", "hair-care"), "scalp-care");
  assert.equal(guess("Durex Fetherlite Condom 3 pcs", "personal-care"), "condom");
});

test("SPF with the number stuck to it still reads as sun protection", () => {
  // \bspf\b never matched "SPF15": there is no word boundary between "f" and
  // "1", so every product written that way fell through to the cream rule.
  assert.equal(guess("Smooth E Sun Protection SPF50 PA+++", "skincare"), "sunscreen");
  assert.equal(guess("Physical White Extra Fluid SPF50", "skincare"), "sunscreen");
});

test("a lip product is lip care, not whatever its texture is", () => {
  // "Blistex Berry SPF15" was being filed as a face cream, and then as a
  // sunscreen. It is a lip balm — which its name never says and its
  // description does, so the description is part of the input on purpose.
  assert.equal(
    guess("Blistex Berry SPF15", "skincare", "Best-Selling Lip Balm in the U.S. – Berry Scented with Cocoa Butter & SPF 15 Protection"),
    "lip-care"
  );
  // And when the description says nothing useful — this one is the single
  // word "คุณสมบัติ" in the catalogue — the brand still has to carry it.
  assert.equal(guess("Blistex Flip Top Cap Spf 50 Lip Balm", "skincare", "คุณสมบัติ"), "lip-care");
  assert.equal(guess("Eucerin Aquaphor SOS LIP CARE 10 ML ลิปฟื้นบำรุงริมฝีปาก", "skincare"), "lip-care");
});

test("an acne treatment is not a moisturiser because it is a gel", () => {
  assert.equal(guess("ACNE-AID SPOT GEL ANTI-ACNE 10 G.", "skincare"), "acne-care");
  assert.equal(guess("CERAVE BLEMISH CONTROL GEL เซราวี", "skincare"), "acne-care");
});

test("contact lens solution is eye care, not first aid", () => {
  // Its description mentions ฆ่าเชื้อ, and first aid used to be tested first,
  // so twelve bottles of lens solution were shelved as plasters.
  assert.equal(
    guess("OPTI-FREE PUREMOIST 300 ml", "personal-care", "น้ำยาล้างคอนแทคเลนส์ ฆ่าเชื้อ"),
    "eye-drops"
  );
  assert.equal(guess("3M NEXCARE MAXHOLD BANDAGE 3S", "personal-care"), "first-aid");
});

test("vitamin C sold under another name is still a vitamin", () => {
  assert.equal(guess("BLACKMORES BIO C 500 MG DAILY IMU + CHEWABLE", "wellness"), "vitamin");
  assert.equal(guess("BLACKMORES BIO C ACEROLA PLUS 1500 MG", "wellness"), "vitamin");
});

test("a scalp serum is hair care, not a face serum", () => {
  assert.equal(guess("Smooth E Hair Serum เซรั่มบำรุงหนังศีรษะ", "hair-care"), "scalp-care");
});

test("nothing matched is a real answer, not a shelf", () => {
  // There is deliberately no catch-all. A rule that matches "เม็ด" or
  // "capsule" would sweep up every supplement in the shop and call it a
  // category, which is a bin with a label on it.
  assert.equal(guess("BLACKMORES CHOLES-BLOC แบลคมอร์ส โคเลส-บลอค 60 เม็ด", "wellness"), null);
  assert.equal(guess("สินค้าที่ไม่มีกฎไหนจับได้", "wellness"), null);
});

test("a category with no rules returns no shelves and no guess", () => {
  assert.deepEqual(subcategoriesOf("does-not-exist"), []);
  assert.equal(guess("อะไรก็ตาม", "does-not-exist"), null);
});

test("every rule has a Thai label, and no category repeats a slug", () => {
  for (const [category, subs] of Object.entries(SUBCATEGORIES)) {
    const slugs = subs.map((s) => s.slug);
    assert.equal(new Set(slugs).size, slugs.length, `${category} has a duplicate slug`);
    for (const sub of subs) {
      assert.ok(sub.nameTh.trim().length > 0, `${category}/${sub.slug} has no Thai label`);
      assert.equal(subcategoryLabel(category, sub.slug), sub.nameTh);
    }
  }
});

test("a guess always names a shelf that exists in that category", () => {
  const samples: [string, string][] = [
    ["skincare", "Eucerin HYALURON-FILLER SERUM"],
    ["oral-care", "Dentiste mouthwash น้ำยาบ้วนปาก"],
    ["body-care", "CERAVE Moisturising Lotion โลชั่นบำรุงผิว"],
    ["wellness", "Smooth Life Collagen คอลลาเจน"],
  ];
  for (const [category, name] of samples) {
    const slug = guess(name, category);
    assert.ok(slug, `${name} should have matched something`);
    assert.ok(
      subcategoriesOf(category).some((s) => s.slug === slug),
      `${slug} is not a shelf in ${category}`
    );
  }
});

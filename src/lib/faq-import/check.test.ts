import { test } from "node:test";
import assert from "node:assert/strict";
import { checkItem, canPublish, blocking, warnings } from "./check.ts";

const ok = {
  question_th: "ผิวมันควรใช้อะไร?",
  answer_th: "เลือกกลุ่ม Acne-5 และโฟมล้างหน้าสูตรอ่อนโยน",
  question_en: "What suits oily skin?",
  answer_en: "Explore the Acne-5 range.",
};

const has = (issues: ReturnType<typeof checkItem>, field: string) => issues.some((i) => i.field === field);

test("ข้อที่ครบถ้วน ไม่ติดอะไรเลย", () => {
  assert.deepEqual(checkItem(ok), []);
  assert.equal(canPublish(checkItem(ok)), true);
});

test("ขาดคำถามหรือคำตอบไทย = บล็อก", () => {
  assert.equal(canPublish(checkItem({ ...ok, question_th: "  " })), false);
  assert.equal(canPublish(checkItem({ ...ok, answer_th: "" })), false);
});

test("ข้อความค้างของคนเขียน = บล็อก", () => {
  for (const text of ["[เติมราคาตรงนี้]", "TODO ถามทีม", "[Fill in later]", "ราคา TBD"]) {
    const issues = checkItem({ ...ok, answer_th: `คำตอบ ${text}` });
    assert.equal(canPublish(issues), false, text);
  }
});

test('"xxx" ที่อยู่กลางคำอื่น ไม่นับเป็นข้อความค้าง', () => {
  // Flagging every xxx inside a code or a URL is how a warning gets ignored.
  assert.equal(canPublish(checkItem({ ...ok, answer_th: "รหัสสินค้า ABCxxxDEF ใช้ได้" })), true);
  assert.equal(canPublish(checkItem({ ...ok, answer_th: "ใส่ xxx ตรงนี้" })), false);
});

test("สินค้าที่ไม่มีในร้าน = บล็อก · หมดทุกตัว = เตือน", () => {
  const productStatus = (slug: string) =>
    slug === "ghost" ? { exists: false, buyable: false } : { exists: true, buyable: slug !== "sold-out" };

  const missing = checkItem({ ...ok, product_slugs: ["ghost"] }, { productStatus });
  assert.equal(canPublish(missing), false);
  assert.ok(blocking(missing).some((i) => i.message.includes("ghost")));

  const allGone = checkItem({ ...ok, product_slugs: ["sold-out"] }, { productStatus });
  assert.equal(canPublish(allGone), true, "ของหมดไม่ควรบล็อก");
  assert.ok(warnings(allGone).some((i) => i.field === "product_slugs"));

  // One buyable product is enough for the answer to carry a card.
  const some = checkItem({ ...ok, product_slugs: ["sold-out", "fine"] }, { productStatus });
  assert.equal(warnings(some).filter((i) => i.field === "product_slugs").length, 0);
});

test("ลิงก์ซ้ำกับข้ออื่น = บล็อก", () => {
  const issues = checkItem({ ...ok, public_slug: "taken" }, { slugTaken: (s) => s === "taken" });
  assert.equal(canPublish(issues), false);
  assert.ok(has(issues, "public_slug"));
});

test("ราคาในข้อความ = เตือน ทั้งแบบ ฿ และแบบคำว่าบาท", () => {
  assert.ok(has(warnings(checkItem({ ...ok, answer_th: "ราคา ฿435" })), "answer_th"));
  assert.ok(has(warnings(checkItem({ ...ok, answer_th: "ราคา 435 บาท" })), "answer_th"));
});

test("คำที่อาจเข้าข่ายโฆษณาสรรพคุณ = เตือน ไม่ใช่บล็อก", () => {
  const issues = checkItem({ ...ok, answer_th: "ช่วยรักษาสิวให้หายขาด" });
  assert.equal(canPublish(issues), true, "เป็นดุลพินิจของคน ไม่ใช่กฎตายตัว");
  const w = warnings(issues).find((i) => i.message.includes("โฆษณาสรรพคุณ"));
  assert.ok(w && w.message.includes("รักษา") && w.message.includes("หายขาด"), w?.message);
});

test("คำอังกฤษต้องแมตช์ทั้งคำ ไม่ใช่ชิ้นส่วนของคำอื่น", () => {
  // "heal" อยู่ใน health/healthy/healthcare และ "cure" อยู่ใน secure/manicure
  // ตอนลองกับข้อมูลจริง 33 ข้อ กฎแบบหลวมติดธง 4 ข้อเพราะคำว่า health เฉยๆ
  const safe = [
    "Healthy Aging range from Smooth Life",
    "consult a healthcare professional",
    "Gut Health products",
    "a secure checkout and a manicure set",
  ];
  for (const text of safe) {
    const w = warnings(checkItem({ ...ok, answer_en: text }));
    assert.equal(w.filter((i) => i.message.includes("โฆษณาสรรพคุณ")).length, 0, text);
  }
  // คำเต็มยังต้องติดอยู่
  assert.ok(
    warnings(checkItem({ ...ok, answer_en: "This will cure acne" })).some((i) => i.message.includes("cure"))
  );
});

test("ไม่มีภาษาอังกฤษ = เตือน", () => {
  assert.ok(has(warnings(checkItem({ ...ok, answer_en: "" })), "question_en"));
});

test("คำตอบยาวเกิน = เตือน พร้อมบอกจำนวนตัวอักษร", () => {
  const issues = warnings(checkItem({ ...ok, answer_th: "ก".repeat(700) }));
  assert.ok(issues.some((i) => i.message.includes("700")), JSON.stringify(issues));
});

test("ลิงก์ปุ่มที่ออกนอกเว็บ = เตือน", () => {
  assert.ok(has(warnings(checkItem({ ...ok, cta_href: "https://example.com" })), "cta_href"));
  assert.equal(warnings(checkItem({ ...ok, cta_href: "/collections/value-sets" })).filter((i) => i.field === "cta_href").length, 0);
  // Protocol-relative is not an internal link however much it looks like one.
  assert.ok(has(warnings(checkItem({ ...ok, cta_href: "//evil.example" })), "cta_href"));
});

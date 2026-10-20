import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImport, detectFormat, parseCsvRows, slugifyEn, clean } from "./parse.ts";

// The two document shapes, in miniature. Written to the same rules as the
// real "FAQ for AI-search" docs: Option 1 is numbered topics whose tables
// export as one cell per line, Option 2 is a numbered list run twice with
// THAI VERSION between the languages.

const OPTION1 = `1. Skincare
Collections: Acne Care, Daily Care
Trigger keywords
EN Q&A
TH Q&A
acne, pimples, หน้ามัน
What products are suitable for oily skin? Try the Acne-5 range.
ผิวมันใช้อะไรดี? ลองกลุ่ม Acne-5 ได้เลย
sunscreen, กันแดด
Which sunscreen should I pick? Choose by finish and SPF.
เลือกกันแดดยังไง? เลือกตามเนื้อสัมผัสและค่า SPF
2. Oral care
Trigger keywords
EN Q&A
TH Q&A
เสียวฟัน, sensitive teeth
What helps sensitive teeth? Consider Repaire 2-in-1.
เสียวฟันใช้อะไรดี? ลอง Repaire 2-in-1`;

const OPTION2 = `01 | SKINCARE
01. What products are suitable for oily skin?
Explore the Acne-5 range and gentle cleansers.
Choose by skin type.
02 | ORAL CARE
02. What helps sensitive teeth?
Consider DENTISTE' Repaire 2-in-1.
THAI VERSION
01 | ผิวหน้า
01. ผิวมันควรใช้อะไร?
เลือกกลุ่ม Acne-5 และโฟมล้างหน้าสูตรอ่อนโยน
เลือกตามสภาพผิว
02 | ช่องปาก
02. เสียวฟันควรใช้อะไร?
พิจารณา DENTISTE' Repaire 2-in-1`;

test("Option 1: สามบรรทัดคือหนึ่งแถว และแยกคำถามกับคำตอบที่ ? ตัวแรก", () => {
  const r = parseImport(OPTION1);
  assert.equal(r.format, "option1");
  assert.equal(r.items.length, 3);

  const first = r.items[0];
  assert.equal(first.source_ref, "opt1:1.1");
  assert.equal(first.question_en, "What products are suitable for oily skin?");
  assert.equal(first.answer_en, "Try the Acne-5 range.");
  assert.equal(first.question_th, "ผิวมันใช้อะไรดี?");
  assert.equal(first.answer_th, "ลองกลุ่ม Acne-5 ได้เลย");
  assert.deepEqual(first.keywords, ["acne", "pimples", "หน้ามัน"]);
  assert.equal(first.section, "Skincare");

  // Numbering restarts inside each topic, which is what makes the reference
  // stable when a topic above gains a row.
  assert.equal(r.items[2].source_ref, "opt1:2.1");
  assert.equal(r.items[2].section, "Oral care");
});

test("Option 1: หัวข้อที่มี ? ไม่ใช่หัวข้อ แต่เป็นคำถาม", () => {
  // A numbered line that is itself a question must not open a new topic, or
  // every question in a numbered list would become a heading.
  const r = parseImport(`1. Topic
Trigger keywords
EN Q&A
TH Q&A
kw
2. Is this a question? Yes.
2. นี่คือคำถามใช่ไหม? ใช่`);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].question_en, "2. Is this a question?");
});

test("Option 2: จับคู่ EN กับ TH ด้วยเลขข้อ ไม่ใช่ลำดับ", () => {
  const r = parseImport(OPTION2);
  assert.equal(r.format, "option2");
  assert.equal(r.items.length, 2);

  assert.equal(r.items[0].source_ref, "opt2:01");
  assert.equal(r.items[0].question_en, "What products are suitable for oily skin?");
  assert.equal(r.items[0].question_th, "ผิวมันควรใช้อะไร?");
  // Lines after the question join into one answer.
  assert.equal(r.items[0].answer_en, "Explore the Acne-5 range and gentle cleansers. Choose by skin type.");
  assert.equal(r.items[0].answer_th, "เลือกกลุ่ม Acne-5 และโฟมล้างหน้าสูตรอ่อนโยน เลือกตามสภาพผิว");
  assert.equal(r.items[0].section, "SKINCARE");
});

test("Option 2: ข้อที่ขาดฉบับภาษาไทย ต้องบอก ไม่ใช่เงียบ", () => {
  const r = parseImport(`01 | SECTION
01. Only English here?
Answer.
THAI VERSION`);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].question_th, "");
  assert.ok(r.skipped.some((s) => s.includes("ไม่มีฉบับภาษาไทย")), r.skipped.join(" / "));
});

test("ตรวจรูปแบบเองได้ทั้งสี่แบบ", () => {
  assert.equal(detectFormat(OPTION1), "option1");
  assert.equal(detectFormat(OPTION2), "option2");
  assert.equal(detectFormat('source_ref,question_th,answer_th\na,b,c'), "csv");
  assert.equal(detectFormat('{"items":[]}'), "json");
  // Something that starts like JSON but is not must not be treated as JSON.
  assert.notEqual(detectFormat("{ this is not json"), "json");
});

test("CSV: เครื่องหมายคำพูด คอมมาในประโยค และขึ้นบรรทัดใหม่ในช่อง", () => {
  const rows = parseCsvRows('a,b\n"one, two","he said ""hi""\nsecond line"\n');
  assert.deepEqual(rows[0], ["a", "b"]);
  assert.deepEqual(rows[1], ["one, two", 'he said "hi"\nsecond line']);
});

test("CSV: หลายค่าในช่องเดียวคั่นด้วย | เพราะคอมมาเป็นเนื้อความ", () => {
  const csv =
    "source_ref,topic,concerns,question_th,answer_th,keywords,pinned\n" +
    'x1,skincare,acne|dryness,"คำถาม, มีคอมมา",คำตอบ,หน้ามัน|สิว,true\n';
  const r = parseImport(csv);
  assert.equal(r.format, "csv");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].question_th, "คำถาม, มีคอมมา");
  assert.deepEqual(r.items[0].concerns, ["acne", "dryness"]);
  assert.deepEqual(r.items[0].keywords, ["หน้ามัน", "สิว"]);
  assert.equal(r.items[0].topic, "skincare");
  assert.equal(r.items[0].pinned, true);
});

test("CSV: แถวที่ไม่มีคำถามและคำตอบไทย ถูกข้ามพร้อมบอกเลขแถว", () => {
  const r = parseImport("source_ref,question_th,answer_th\nx1,,\nx2,ถาม,ตอบ\n");
  assert.equal(r.items.length, 1);
  assert.ok(r.skipped.some((s) => s.includes("แถว 2")), r.skipped.join(" / "));
});

test("JSON: รับทั้ง brands/brand_slugs และ product_slugs/product_tags", () => {
  const r = parseImport(
    JSON.stringify({
      items: [
        { source_ref: "a", question_th: "ถาม", answer_th: "ตอบ", brand_slugs: ["smooth-e"], product_tags: ["p1"] },
        { source_ref: "b", question_th: "ถาม2", answer_th: "ตอบ2", brands: ["dentiste"], product_slugs: ["p2"] },
      ],
    })
  );
  assert.equal(r.format, "json");
  assert.deepEqual(r.items[0].brands, ["smooth-e"]);
  assert.deepEqual(r.items[0].product_slugs, ["p1"]);
  assert.deepEqual(r.items[1].brands, ["dentiste"]);
  assert.deepEqual(r.items[1].product_slugs, ["p2"]);
});

test("หัวข้อ ปัญหา แบรนด์ ไม่ถูกเดาจากเอกสาร", () => {
  // The seed got these from a person reading all thirty-three and filing
  // them. A parser that guessed would be making up the one field that is a
  // judgement — the import preview asks instead.
  for (const text of [OPTION1, OPTION2]) {
    for (const item of parseImport(text).items) {
      assert.equal(item.topic, null);
      assert.deepEqual(item.concerns, []);
      assert.deepEqual(item.brands, []);
    }
  }
});

test("slug ภาษาอังกฤษ และการเก็บกวาดช่องว่างของ Google Docs", () => {
  assert.equal(slugifyEn("What products are suitable for acne-prone or oily skin?"), "what-products-are-suitable-for-acne-prone-or-oily-skin");
  assert.equal(clean("a  b\n c"), "a b c");
});

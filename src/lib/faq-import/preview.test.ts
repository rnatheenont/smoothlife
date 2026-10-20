import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPreview, previewCounts, similarity, type ExistingArticle } from "./preview.ts";
import { parseImport } from "./parse.ts";

const item = (over: Partial<Record<string, unknown>> = {}) => ({
  source_ref: "opt2:01",
  question_th: "ผิวมันควรใช้อะไร?",
  answer_th: "เลือกกลุ่ม Acne-5",
  question_en: "What suits oily skin?",
  answer_en: "The Acne-5 range.",
  keywords: ["หน้ามัน"],
  topic: null,
  concerns: [],
  brands: [],
  product_slugs: [],
  cta_label: null,
  cta_href: null,
  public_slug: "what-suits-oily-skin",
  visibility: "public" as const,
  pinned: false,
  section: null,
  ...over,
});

const existing = (over: Partial<ExistingArticle> = {}): ExistingArticle => ({
  id: "a1",
  source_ref: "opt2:01",
  title: "ผิวมันควรใช้อะไร?",
  public_slug: "what-suits-oily-skin",
  status: "published",
  updated_at: "2026-10-20T04:00:00Z",
  ...over,
});

test("ไม่เจอ source_ref และไม่คล้ายใคร = ใหม่ และติ๊กไว้ให้", () => {
  const rows = buildPreview([item()], []);
  assert.equal(rows[0].status, "new");
  assert.equal(rows[0].selected, true);
});

test("เจอ source_ref เดิม = อัปเดต และบอกว่าฟิลด์ไหนเปลี่ยน", () => {
  const rows = buildPreview([item({ answer_th: "คำตอบใหม่" })], [existing()], {
    current: new Map([["a1", { question_th: "ผิวมันควรใช้อะไร?", answer_th: "คำตอบเดิม", keywords: ["หน้ามัน"] }]]),
  });
  assert.equal(rows[0].status, "update");
  assert.equal(rows[0].matchId, "a1");
  assert.ok(rows[0].changed.includes("answer_th"));
  assert.ok(!rows[0].changed.includes("question_th"));
  assert.equal(rows[0].selected, true);
});

test("นำเข้าซ้ำโดยไม่แก้อะไร = ไม่มีฟิลด์เปลี่ยน และไม่ถูกติ๊ก", () => {
  // Re-importing an unchanged document must not look like thirty edits, or
  // nobody will read the preview the time it matters.
  const same = item();
  const rows = buildPreview([same], [existing()], {
    current: new Map([
      [
        "a1",
        {
          question_th: same.question_th,
          answer_th: same.answer_th,
          question_en: same.question_en,
          answer_en: same.answer_en,
          keywords: same.keywords,
          topic: null,
          concerns: [],
          brands: [],
          product_slugs: [],
          cta_label: null,
          cta_href: null,
        },
      ],
    ]),
  });
  assert.equal(rows[0].status, "update");
  assert.deepEqual(rows[0].changed, []);
  assert.equal(rows[0].selected, false);
});

test("แก้ในระบบหลังนำเข้าครั้งก่อน = ขัดแย้ง ไม่ทับให้เอง", () => {
  const rows = buildPreview([item({ answer_th: "จากเอกสาร" })], [existing({ updated_at: "2026-10-20T05:00:00Z" })], {
    current: new Map([["a1", { answer_th: "คนแก้ไว้ในระบบ" }]]),
    lastImportAt: "2026-10-20T04:30:00Z",
  });
  assert.equal(rows[0].status, "conflict");
  assert.equal(rows[0].selected, false);
  assert.ok(rows[0].note?.includes("มีคนแก้"));
});

test("แก้ในระบบ แต่เอกสารไม่มีอะไรต่าง = ไม่ใช่ขัดแย้ง", () => {
  const same = item();
  const rows = buildPreview([same], [existing({ updated_at: "2026-10-20T05:00:00Z" })], {
    current: new Map([
      [
        "a1",
        {
          question_th: same.question_th,
          answer_th: same.answer_th,
          question_en: same.question_en,
          answer_en: same.answer_en,
          keywords: same.keywords,
          topic: null,
          concerns: [],
          brands: [],
          product_slugs: [],
          cta_label: null,
          cta_href: null,
        },
      ],
    ]),
    lastImportAt: "2026-10-20T04:30:00Z",
  });
  assert.equal(rows[0].status, "update");
  assert.deepEqual(rows[0].changed, []);
});

test("คำถามคล้ายข้อที่มีอยู่แต่คนละ ref = อาจซ้ำ และไม่ติ๊กให้", () => {
  const rows = buildPreview(
    [item({ source_ref: "csv:2", public_slug: "another-slug" })],
    [existing({ source_ref: "opt2:01", title: "ผิวมันควรใช้อะไรดี?" })]
  );
  assert.equal(rows[0].status, "duplicate");
  assert.equal(rows[0].selected, false);
  assert.ok(rows[0].note?.includes("%"));
});

test("ลิงก์ชนกับข้ออื่น = ใช้ไม่ได้ แต่ลิงก์ของตัวเองไม่ชน", () => {
  // Its own slug coming back on an update is not a clash; another article
  // holding it is.
  const own = buildPreview([item()], [existing()], { current: new Map() });
  assert.notEqual(own[0].status, "invalid");

  const clash = buildPreview([item({ source_ref: "csv:9" })], [existing({ id: "other", source_ref: "x", title: "คนละคำถามกันเลย" })]);
  assert.equal(clash[0].status, "invalid");
});

test("แถวที่ขาดคำถามหรือคำตอบไทย = ใช้ไม่ได้ ไม่ว่าจะเจอ ref หรือไม่", () => {
  const rows = buildPreview([item({ answer_th: "" })], [existing()]);
  assert.equal(rows[0].status, "invalid");
  assert.equal(rows[0].selected, false);
});

test("ความคล้ายวัดด้วยคู่อักษร เพราะภาษาไทยไม่เว้นวรรค", () => {
  assert.equal(similarity("เสียวฟันใช้อะไรดี", "เสียวฟันใช้อะไรดี"), 1);
  assert.ok(similarity("ผิวมันควรใช้อะไร?", "ผิวมันควรใช้อะไรดี?") > 0.8);
  assert.ok(similarity("เสียวฟันใช้อะไร", "ของขวัญให้แม่") < 0.2);
  assert.equal(similarity("", "อะไรก็ได้"), 0);
});

test("นับยอดตามสถานะได้ครบ", () => {
  const rows = buildPreview([item(), item({ source_ref: "x2", public_slug: "s2", question_th: "คำถามอื่นที่ไม่เหมือนใครเลย" })], []);
  const c = previewCounts(rows);
  assert.equal(c.total, 2);
  assert.equal(c.new, 2);
});

test("เอกสารที่อ่านมาแล้วต่อเข้าพรีวิวได้ทั้งเส้น", () => {
  const parsed = parseImport(`01 | SKINCARE
01. What suits oily skin?
The Acne-5 range.
THAI VERSION
01 | ผิวหน้า
01. ผิวมันควรใช้อะไร?
เลือกกลุ่ม Acne-5`);
  const rows = buildPreview(parsed.items, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "new");
  assert.equal(rows[0].item.source_ref, "opt2:01");
});

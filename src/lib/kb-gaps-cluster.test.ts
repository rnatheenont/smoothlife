import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterGaps, cosine, textSimilarity, NEAR_BY_TEXT, type GapRow } from "./kb-gaps-cluster.ts";

const gap = (over: Partial<GapRow> & { id: string; question: string }): GapRow => ({
  examples: [over.question],
  hits: 1,
  sources: ["chat"],
  embedding: null,
  first_seen: "2026-10-20T00:00:00Z",
  ...over,
});

test("คำถามที่เขียนต่างกันนิดเดียว ถูกรวมเป็นข้อเดียว", () => {
  const rows = [
    gap({ id: "a", question: "ส่งกี่วันถึง", hits: 5, sources: ["chat"] }),
    gap({ id: "b", question: "ส่งกี่วันถึงคะ", hits: 3, sources: ["faq"] }),
  ];
  const [c] = clusterGaps(rows);
  assert.ok(c, "ควรรวมได้");
  // The one asked most often is the one that stays.
  assert.equal(c.keep.id, "a");
  assert.equal(c.confident, false, "ไม่มี embedding จึงเป็นข้อเสนอ");
  assert.deepEqual(c.merge.map((m) => m.id), ["b"]);
  assert.equal(c.merged.hits, 8);
  assert.deepEqual(c.merged.sources.sort(), ["chat", "faq"]);
  assert.equal(c.merged.examples.length, 2);
});

test("คำถามคนละเรื่อง ไม่ถูกรวม", () => {
  const rows = [
    gap({ id: "a", question: "ส่งกี่วันถึง" }),
    gap({ id: "b", question: "เสียวฟันใช้ยาสีฟันอะไร" }),
    gap({ id: "c", question: "สมัครสมาชิกยังไง" }),
  ];
  assert.deepEqual(clusterGaps(rows), []);
});

test("กลุ่มที่ตัดสินด้วยตัวอักษร ต้องไม่ถูกรวมเอง ต้องให้คนกดรับ", () => {
  // Measured on real pairs: the different question (0.875) sits between two
  // same questions (0.846 and 0.917), so no threshold separates them. The
  // code does not pretend otherwise — it flags the group and asks.
  const sunscreen = clusterGaps([
    gap({ id: "a", question: "ครีมกันแดดสำหรับผิวมันใช้ตัวไหนดี" }),
    gap({ id: "b", question: "ครีมกันแดดสำหรับผิวแห้งใช้ตัวไหนดี" }),
  ]);
  assert.equal(sunscreen.length, 1, "คู่นี้คล้ายพอจะเสนอ");
  assert.equal(sunscreen[0].confident, false, "แต่ห้ามรวมเอง");

  const polite = clusterGaps([
    gap({ id: "a", question: "ส่งกี่วันถึง" }),
    gap({ id: "b", question: "ส่งกี่วันถึงครับ" }),
  ]);
  assert.equal(polite.length, 1);
  assert.equal(polite[0].confident, false);
});

test("ถ้ามี embedding ใช้ embedding ไม่ใช่ตัวอักษร", () => {
  // Same meaning, almost no characters in common — only an embedding can see
  // that, and this is the case the whole queue exists to collapse.
  const v = (x: number[]) => x;
  const rows = [
    gap({ id: "a", question: "นอนไม่หลับ", embedding: v([1, 0, 0]), hits: 2 }),
    gap({ id: "b", question: "หลับยากมาก", embedding: v([0.97, 0.24, 0]), hits: 1 }),
    gap({ id: "c", question: "ส่งกี่วัน", embedding: v([0, 1, 0]) }),
  ];
  const clusters = clusterGaps(rows);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].keep.id, "a");
  assert.deepEqual(clusters[0].merge.map((m) => m.id), ["b"]);
  assert.equal(clusters[0].confident, true, "ตัดสินด้วย embedding ทั้งคู่ จึงรวมเองได้");
});

test("แถวที่มี embedding กับแถวที่ไม่มี ตกไปใช้ตัวอักษร และกลายเป็นข้อเสนอ", () => {
  const rows = [
    gap({ id: "a", question: "ส่งกี่วันถึง", embedding: [1, 0, 0], hits: 4 }),
    gap({ id: "b", question: "ส่งกี่วันถึงคะ", embedding: null, hits: 1 }),
  ];
  const [c] = clusterGaps(rows);
  assert.ok(c, "ยังต้องเสนอได้ แม้ข้อมูลจะไม่ครบทั้งสองฝั่ง");
  assert.equal(c.keep.id, "a");
  assert.equal(c.confident, false, "ฝั่งหนึ่งไม่มี embedding จึงเชื่อไม่ได้พอจะรวมเอง");
});

test("รันซ้ำแล้วได้ผลเดิม ไม่สลับแถวที่เก็บไว้", () => {
  // Equal counts: the one seen first wins, so a daily job does not keep
  // swapping which row survives.
  const rows = [
    gap({ id: "later", question: "ส่งกี่วันถึง", first_seen: "2026-10-20T10:00:00Z" }),
    gap({ id: "earlier", question: "ส่งกี่วันถึงคะ", first_seen: "2026-10-19T10:00:00Z" }),
  ];
  assert.equal(clusterGaps(rows)[0].keep.id, "earlier");
  assert.equal(clusterGaps([...rows].reverse())[0].keep.id, "earlier");
});

test("หนึ่งแถวถูกรวมได้ครั้งเดียว ไม่โดนนับซ้ำในสองกลุ่ม", () => {
  const rows = [
    gap({ id: "a", question: "ส่งกี่วันถึง", hits: 9 }),
    gap({ id: "b", question: "ส่งกี่วันถึงคะ", hits: 5 }),
    gap({ id: "c", question: "ส่งกี่วันถึงครับ", hits: 1 }),
  ];
  const clusters = clusterGaps(rows);
  const touched = clusters.flatMap((c) => [c.keep.id, ...c.merge.map((m) => m.id)]);
  assert.equal(new Set(touched).size, touched.length, "มีแถวโดนนับสองครั้ง");
  // All three are the same question written three ways, and at 0.80 all
  // three are offered together — as a suggestion, since none has an
  // embedding, so nothing merges until a person says so.
  assert.equal(clusters[0].merged.hits, 15);
  assert.equal(clusters[0].confident, false);
});

test("cosine กับ textSimilarity ให้ค่าที่คาดได้", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([], []), 0);
  assert.equal(cosine([1, 0], [1, 0, 0]), 0, "ความยาวไม่เท่ากันต้องไม่ระเบิด");
  assert.equal(textSimilarity("เสียวฟัน", "เสียวฟัน"), 1);
  assert.ok(textSimilarity("ส่งกี่วันถึง", "ส่งกี่วันถึงคะ") >= NEAR_BY_TEXT);
});

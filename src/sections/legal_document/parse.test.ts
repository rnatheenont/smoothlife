import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLegal } from "./parse.ts";

test("a heading loses its marker and keeps its words", () => {
  const [h] = parseLegal("## ข้อมูลที่เราเก็บ");
  assert.deepEqual(h, { kind: "h2", text: "ข้อมูลที่เราเก็บ", id: "s0" });
});

test("two levels of heading, and everything else is a paragraph", () => {
  const blocks = parseLegal("## หัวข้อ\n\n### หัวข้อย่อย\n\nเนื้อหา");
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["h2", "h3", "p"]
  );
});

test("two clauses with one name still get separate anchors", () => {
  const blocks = parseLegal("## คุกกี้\n\nเนื้อหา\n\n## คุกกี้\n\nเนื้อหา");
  const ids = blocks.filter((b) => b.kind !== "p").map((b) => (b as { id: string }).id);
  assert.equal(new Set(ids).size, ids.length);
});

test("blank space between paragraphs does not become a paragraph", () => {
  const blocks = parseLegal("ย่อหน้าแรก\n\n\n\n   \n\nย่อหน้าที่สอง");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].kind, "p");
});

test("a line that only looks like a heading is not one", () => {
  // No space after the hashes, so it was not meant as a heading.
  const [block] = parseLegal("##ไม่ใช่หัวข้อ");
  assert.equal(block.kind, "p");
  assert.equal(block.text, "##ไม่ใช่หัวข้อ");
});

test("an empty document has no blocks rather than one empty one", () => {
  assert.deepEqual(parseLegal(""), []);
  assert.deepEqual(parseLegal("\n\n   \n"), []);
});

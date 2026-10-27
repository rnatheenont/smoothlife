import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvDocument, csvSlug } from "./csv.ts";

test("a plain cell is written as it is", () => {
  assert.equal(csvCell("Yuling Wang"), "Yuling Wang");
  assert.equal(csvCell(36), "36");
});

test("nothing is an empty cell, not the word null", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
});

test("commas, quotes and newlines are quoted", () => {
  assert.equal(csvCell("Wang, Yuling"), '"Wang, Yuling"');
  assert.equal(csvCell('he said "hi"'), '"he said ""hi"""');
  assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
  // A lone CR counts too: a cell pasted in from Excel on a Mac can carry one,
  // and unquoted it ends the row early and shifts every column after it.
  assert.equal(csvCell("a\rb"), '"a\rb"');
});

test("a cell that starts like a formula is defused", () => {
  // The reason this rule exists: a name beginning with any of these is run
  // by the spreadsheet that opens the file, and these files get forwarded.
  for (const lead of ["=", "+", "-", "@"]) {
    assert.equal(csvCell(`${lead}cmd`), `'${lead}cmd`);
  }
  // Still quoted when it also contains a comma — the two rules compose.
  assert.equal(csvCell("=a,b"), `"'=a,b"`);
});

test("a negative number is defused too, and stays readable", () => {
  // -5 is a formula lead by Excel's rules. Keeping the quote costs a visible
  // apostrophe in the cell; letting it through costs a file that executes.
  assert.equal(csvCell(-5), "'-5");
});

test("the document carries the BOM and CRLF rows", () => {
  const out = csvDocument(["ลูกค้า", "สิทธิ์"], [["Yuling Wang", 36], ["วัชราภรณ์", 18]]);
  assert.ok(out.startsWith("﻿"), "ไม่มี BOM — Excel บน Windows จะอ่านภาษาไทยเป็นขยะ");
  assert.equal(out.slice(1), "ลูกค้า,สิทธิ์\r\nYuling Wang,36\r\nวัชราภรณ์,18");
});

test("a document with no rows is still a header", () => {
  assert.equal(csvDocument(["a", "b"], []).slice(1), "a,b");
});

test("slugs keep Thai letters and drop everything else", () => {
  assert.equal(csvSlug("DENTISTE'S x KENG NAMPING"), "DENTISTE-S-x-KENG-NAMPING");
  assert.equal(csvSlug("กิจกรรม ใบเสร็จ"), "กิจกรรม-ใบเสร็จ");
  // No leading or trailing dash, which would read as a broken filename.
  assert.equal(csvSlug("!! ปีใหม่ !!"), "ปีใหม่");
  assert.equal(csvSlug("abcdefghij", 4), "abcd");
});

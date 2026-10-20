import { test } from "node:test";
import assert from "node:assert/strict";
import { exportUrlFor, SourceError } from "./source.ts";

const refused = (url: string) => assert.throws(() => exportUrlFor(url), SourceError, url);

test("ลิงก์ Google Docs กลายเป็นลิงก์ export แบบข้อความ", () => {
  const { url, kind } = exportUrlFor("https://docs.google.com/document/d/1cDLBshnyUC2WEz/edit?usp=sharing");
  assert.equal(url, "https://docs.google.com/document/d/1cDLBshnyUC2WEz/export?format=txt");
  assert.equal(kind, "doc");
});

test("ลิงก์ Google Sheets กลายเป็น CSV และพา gid ไปด้วย", () => {
  assert.equal(
    exportUrlFor("https://docs.google.com/spreadsheets/d/AbC_123/edit#gid=456").url,
    "https://docs.google.com/spreadsheets/d/AbC_123/export?format=csv&gid=456"
  );
  assert.equal(
    exportUrlFor("https://docs.google.com/spreadsheets/d/AbC_123/edit").url,
    "https://docs.google.com/spreadsheets/d/AbC_123/export?format=csv"
  );
});

test("โฮสต์อื่นถูกปฏิเสธ รวมถึงที่พยายามทำให้ดูเหมือน", () => {
  // The server fetches an address a user chose, so the list is of hosts and
  // it is checked on the parsed URL — not by looking for "docs.google.com"
  // somewhere in the string, which every one of these would pass.
  refused("https://evil.example/document/d/x/edit");
  refused("https://docs.google.com.evil.example/document/d/x/edit");
  refused("https://evil.example/?q=docs.google.com/document/d/x");
  refused("https://user@evil.example/document/d/x");
  refused("https://169.254.169.254/latest/meta-data/");
  refused("http://localhost:3000/document/d/x");
});

test("ต้องเป็น https เท่านั้น", () => {
  refused("http://docs.google.com/document/d/x/edit");
  refused("file:///etc/passwd");
});

test("ลิงก์ Google ที่ไม่ใช่เอกสารหรือชีต ถูกปฏิเสธ", () => {
  refused("https://docs.google.com/forms/d/x/viewform");
  refused("https://docs.google.com/");
});

test("ข้อความที่ไม่ใช่ URL เลย", () => {
  refused("ไม่ใช่ลิงก์");
  refused("");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// TypeScript already makes en.ts fill in exactly the keys th.ts declares, and
// that is the real guard. This is the one for the day somebody reaches for
// `as Messages` or `as any` to make a build go green — a cast turns the
// compiler off, and the result is an English page with a Thai word in it,
// which nobody notices because the page still renders.
//
// A text scan rather than an import: these are plain .ts files, but the
// module they sit beside pulls in the section registry through "@/", and
// `node --test` cannot resolve that alias. Reading the two files and
// comparing the keys they write is enough to answer the only question here.

const DIR = join(process.cwd(), "src", "lib", "i18n", "messages");

/** The key names written in one messages file, as "group.key". */
function keysOf(source: string): string[] {
  const out: string[] = [];
  let group = "";
  for (const raw of source.split("\n")) {
    const line = raw.replace(/\/\/.*$/, "");
    const open = line.match(/^\s{2}([a-zA-Z][\w]*):\s*\{/);
    if (open) {
      group = open[1];
      continue;
    }
    if (/^\s{2}\}/.test(line)) {
      group = "";
      continue;
    }
    const key = line.match(/^\s{4}([a-zA-Z][\w]*):/);
    if (key && group) out.push(`${group}.${key[1]}`);
  }
  return out.sort();
}

const th = readFileSync(join(DIR, "th.ts"), "utf8");
const en = readFileSync(join(DIR, "en.ts"), "utf8");

test("ไทยกับอังกฤษต้องมีคีย์ชุดเดียวกันเป๊ะ", () => {
  const thKeys = keysOf(th);
  const enKeys = keysOf(en);
  assert.ok(thKeys.length > 0, "อ่านคีย์จาก th.ts ไม่ได้เลย — รูปแบบไฟล์เปลี่ยนไปหรือเปล่า");
  assert.deepEqual(
    enKeys.filter((k) => !thKeys.includes(k)),
    [],
    "en.ts มีคีย์ที่ th.ts ไม่มี"
  );
  assert.deepEqual(
    thKeys.filter((k) => !enKeys.includes(k)),
    [],
    "th.ts มีคีย์ที่ en.ts ยังไม่ได้แปล"
  );
});

test("ไฟล์อังกฤษต้องไม่มีตัวอักษรไทยหลงเหลือ", () => {
  // The failure this catches is a copy-paste: duplicate the Thai file, change
  // half the lines, ship the other half.
  const thai = en
    .split("\n")
    .map((line, i) => ({ line: i + 1, text: line }))
    .filter((l) => /[฀-๿]/.test(l.text) && !/^\s*(\/\/|\*|\/\*)/.test(l.text));
  assert.deepEqual(
    thai.map((l) => `บรรทัด ${l.line}: ${l.text.trim().slice(0, 70)}`),
    [],
    "en.ts ยังมีภาษาไทยอยู่"
  );
});

test("ไม่มีข้อความไหนเป็นค่าว่าง", () => {
  for (const [name, source] of [["th.ts", th], ["en.ts", en]] as const) {
    const empty = source.split("\n").filter((l) => /^\s{4}[a-zA-Z][\w]*:\s*""/.test(l));
    assert.deepEqual(empty, [], `${name} มีข้อความที่เป็นค่าว่าง`);
  }
});

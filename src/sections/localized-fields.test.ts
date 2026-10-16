import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A field that may hold two languages must be read through tx().
//
// TypeScript already catches most ways of getting this wrong, and that is
// worth saying out loud so this test is not mistaken for the whole guard:
// once a field's type is `string | {th, en?}`, calling .trim() on it, putting
// it straight into JSX, or passing it to a prop typed `string` are all type
// errors. What the compiler does NOT catch is the handful of ways an object
// quietly becomes something:
//
//   `${settings.title}`        → "[object Object]" on the page
//   settings.title || "..."    → an object is always truthy, so a section
//                                with an empty Thai title stops falling back
//   if (!settings.title)       → same, inverted: the "nothing to draw here"
//                                branch never runs again
//   String(x) / JSON.stringify → prints the shape at the customer
//
// Those are the ones that reach a customer looking like a bug in the shop
// rather than a bug in the code, so they get a test.

const SECTIONS = join(process.cwd(), "src", "sections");

/** The functions that know what to do with a two-language value. */
const READERS = ["tx", "thaiOf", "hasTranslation"];

function definitionFiles(): { name: string; source: string }[] {
  return readdirSync(SECTIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, path: join(SECTIONS, e.name, "definition.tsx") }))
    .map((e) => {
      try {
        return { name: e.name, source: readFileSync(e.path, "utf8") };
      } catch {
        return null;
      }
    })
    .filter((e): e is { name: string; source: string } => e !== null);
}

/**
 * The same source with comments blanked out, line numbers intact.
 *
 * Without this the scan flags the comment explaining the rule, which is a
 * good way to teach people to stop explaining the rule. Spaces rather than
 * deletion so the line and column of everything else stays where it was.
 *
 * `//` is only treated as a comment when it is not preceded by a colon, so
 * the https:// in a link survives.
 */
function withoutComments(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
}

/** Field names declared as translatable in this file's schema. */
function localizedFields(source: string): string[] {
  return [...source.matchAll(/(\w+)\s*:\s*lText\(/g)].map((m) => m[1]);
}

/**
 * Every place the file reads `settings.<field>`, with whether the read is
 * wrapped in one of the readers. Deliberately textual: the point is to catch
 * a read that looks innocent, and a read that looks innocent is exactly what
 * a simple scan sees.
 */
function badReads(source: string, field: string): string[] {
  const out: string[] = [];
  const needle = new RegExp(`settings\\.${field}\\b`, "g");
  for (const m of source.matchAll(needle)) {
    const before = source.slice(Math.max(0, m.index - 60), m.index);
    const wrapped = READERS.some((fn) => new RegExp(`\\b${fn}\\(\\s*$`).test(before));
    if (wrapped) continue;
    const line = source.slice(0, m.index).split("\n").length;
    const text = source.split("\n")[line - 1].trim();
    out.push(`บรรทัด ${line}: ${text.slice(0, 90)}`);
  }
  return out;
}

test("ช่องสองภาษาต้องอ่านผ่าน tx() เท่านั้น", () => {
  const problems: string[] = [];
  for (const { name, source } of definitionFiles()) {
    const code = withoutComments(source);
    for (const field of localizedFields(code)) {
      for (const where of badReads(code, field)) {
        problems.push(`${name}/definition.tsx · settings.${field} · ${where}`);
      }
    }
  }
  assert.deepEqual(
    problems,
    [],
    `อ่านช่องสองภาษาตรงๆ โดยไม่ผ่าน ${READERS.map((r) => r + "()").join(" / ")}:\n  ` +
      problems.join("\n  ")
  );
});

test("ไฟล์ที่ใช้ lText ต้อง import tx มาด้วย", () => {
  for (const { name, source } of definitionFiles()) {
    if (!/\blText\(/.test(source)) continue;
    assert.match(
      source,
      /\btx\b/,
      `section "${name}" ประกาศช่องสองภาษาแต่ไม่ได้ใช้ tx() เลย — แปลว่ามีที่ไหนสักแห่งอ่านค่าดิบ`
    );
  }
});

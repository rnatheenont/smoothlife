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

/**
 * The keys inside the definition's `fields: [...]`, each paired with whether
 * that entry carries `localized: true`.
 *
 * Brace counting rather than a regex over the whole block: a field entry can
 * hold a nested object (a list's columns, an enum's options), and splitting
 * on "{" would cut an entry in half and report the wrong answer for it.
 */
function fieldFlags(source: string): { key: string; localized: boolean }[] {
  const start = source.indexOf("fields: [");
  if (start === -1) return [];
  let depth = 0;
  let entry = "";
  const out: { key: string; localized: boolean }[] = [];
  for (let i = source.indexOf("[", start); i < source.length; i++) {
    const c = source[i];
    if (c === "[" || c === "{") depth++;
    if (c === "]" || c === "}") depth--;
    if (depth === 0) break;
    entry += c;
    // Back at the array's own level means one entry has just closed.
    if (depth === 1 && (c === "}" || c === ",")) {
      const key = entry.match(/key:\s*"([^"]+)"/);
      if (key) out.push({ key: key[1], localized: /localized:\s*true/.test(entry) });
      entry = "";
    }
  }
  return out;
}

// The half of the wiring that nothing else checks.
//
// A field can be translatable in the schema and still have no way to type the
// translation: the admin form only draws the second box for a field marked
// `localized: true`. Miss the mark and the shop looks finished — the English
// page just quietly keeps showing Thai, with no empty box anywhere to hint
// why. The reverse is worse in a smaller way: a field marked localized whose
// schema is still z.string() gives the team an English box whose contents zod
// throws away on save.
test("ช่องที่ประกาศ lText กับช่องที่ติด localized ต้องเป็นชุดเดียวกัน", () => {
  const problems: string[] = [];
  for (const { name, source } of definitionFiles()) {
    const code = withoutComments(source);
    const inSchema = new Set(localizedFields(code));
    const flags = fieldFlags(code);
    for (const { key, localized } of flags) {
      if (inSchema.has(key) && !localized) {
        problems.push(`${name} · "${key}" เป็น lText ในสคีมา แต่ฟอร์มไม่ขึ้นช่องอังกฤษ (ขาด localized: true)`);
      }
      if (!inSchema.has(key) && localized) {
        problems.push(`${name} · "${key}" ติด localized: true แต่สคีมายังไม่ใช่ lText — ค่าอังกฤษจะถูกทิ้งตอนบันทึก`);
      }
    }
  }
  assert.deepEqual(problems, [], `ช่องสองภาษาต่อสายไม่ครบ:\n  ` + problems.join("\n  "));
});

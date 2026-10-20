import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// A route that rebuilds search chunks has to select the columns chunking
// reads. Selecting fewer does not fail: `ChunkableArticle` keeps the FAQ
// fields optional, because the articles written before the FAQ centre have
// none, so `select=id,title,content` type-checks, runs, and quietly rebuilds
// every chunk without its search words or its English half.
//
// That happened. The reindex route selected three columns, and reindexing
// twenty-one published answers stripped the `คำค้น:` line — the line that is
// the only place "หน้ามัน" appears for the article about oily skin — out of
// all of them, then paid Voyage to embed the result.
//
// A compiler cannot see this, so the test reads the source. It reads the
// `select=` lists specifically, and it strips comments first: the first
// version of this test looked for the words "CHUNK_COLUMNS" anywhere in the
// file and passed happily on a file whose only mention of them was a comment
// explaining why they mattered.

const CHUNKERS = ["reindexArticle", "reindexArticles"];
const ACCEPTED = ["KB_COLUMNS", "CHUNK_COLUMNS"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Source with // and /* *\/ comments blanked out, so a prose mention of a
 * constant cannot stand in for using it. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/**
 * Every `select=…` list in the file, as written.
 *
 * Deliberately not tied back to a `kb_articles?` on the same line. The query
 * is a template string, and the part before `select=` routinely contains
 * quotes — `${slice.map(pgValue).join(",")}` — so a regex that walked from
 * the table name to the select list stopped at the first quote and matched
 * nothing, which made this check pass on the very file it exists for.
 */
function selectLists(code: string): string[] {
  return [...code.matchAll(/select=(\$\{[A-Z_]+\}|[A-Za-z_,().!*]+)/g)].map((m) => m[1]);
}

test("ทุก route ที่สร้าง chunk ใหม่ ต้อง select ครบตาม CHUNK_COLUMNS", () => {
  const offenders: string[] = [];
  let scanned = 0;

  for (const path of sourceFiles("src")) {
    // kb.ts is NOT skipped, though it is where the chunking functions are
    // defined. The first version of this test skipped it as "the definition,
    // not a caller" — and backfillEmbeddings lives in it, selects its own
    // rows, and is the path the nightly cron takes. Skipping the file hid the
    // worst instance of the bug the test exists to catch.
    const code = withoutComments(readFileSync(path, "utf8"));
    if (!CHUNKERS.some((fn) => code.includes(`${fn}(`))) continue;
    scanned++;

    const selects = selectLists(code);
    // A file that rebuilds chunks but never reads the article it is chunking
    // got it from somewhere this test cannot see — worth a look either way.
    const ok =
      selects.length > 0 && selects.some((list) => ACCEPTED.some((c) => list === `\${${c}}`));
    if (!ok) offenders.push(path);
  }

  // Without this the test would pass by scanning nothing at all, which is how
  // a source-reading check usually rots.
  assert.ok(scanned >= 4, `คาดว่าจะเจอไฟล์ที่สร้าง chunk ใหม่อย่างน้อย 4 ไฟล์ แต่เจอ ${scanned}`);

  assert.deepEqual(
    offenders,
    [],
    `ไฟล์เหล่านี้สร้าง chunk ใหม่แต่ select ไม่ครบ (ต้องใช้ \${${ACCEPTED.join("} หรือ \${")}}) — ` +
      `chunk จะถูกเขียนทับแบบขาดคำค้นและขาดภาษาอังกฤษ:\n  ${offenders.join("\n  ")}`
  );
});

test("CHUNK_COLUMNS ต้องมีทุกฟิลด์ที่ articleChunks อ่าน", () => {
  // Read out of the source rather than imported: kb.ts imports through the
  // "@/" alias, which `node --test` does not resolve, and a test that needed
  // a loader hook to check one string would be the more fragile half.
  const code = readFileSync("src/lib/kb.ts", "utf8");
  const declared = code.match(/export const CHUNK_COLUMNS\s*=\s*"([^"]+)"/);
  assert.ok(declared, "ไม่เจอ CHUNK_COLUMNS ใน src/lib/kb.ts");
  const selected = new Set(declared[1].split(","));

  const body = code.slice(code.indexOf("export function articleChunks"));
  const fn = body.slice(0, body.indexOf("\n}\n"));
  const read = new Set([...fn.matchAll(/\barticle\.([a-z_]+)/g)].map((m) => m[1]));
  assert.ok(read.size >= 5, `อ่านฟิลด์จาก articleChunks ได้แค่ ${read.size} ฟิลด์ — regex น่าจะพัง`);

  const missing = [...read].filter((field) => !selected.has(field));
  assert.deepEqual(missing, [], `articleChunks อ่านฟิลด์ที่ CHUNK_COLUMNS ไม่ได้ select: ${missing.join(", ")}`);
});

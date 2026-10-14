import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A text scan rather than a real import, because these files are JSX and the
// test runner does not do JSX. That is a weak test in general and the right
// one here: what it catches is a definition that declares a loader and then
// forgets to hand it to the registry.
//
// This is not a hypothetical. category_header was written with a load() that
// counted the products in the category, and the object at the bottom of the
// file did not list it — so the section was handed no data, returned null,
// and every category page lost its <h1> and its count. Nothing failed: no
// type error, no exception, no warning in the build. It was found by
// measuring the page against the old one, which is a good way to find it once
// and a terrible way to keep finding it.

const SECTIONS = join(process.cwd(), "src", "sections");

function definitionFiles(): { name: string; source: string }[] {
  return readdirSync(SECTIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, path: join(SECTIONS, e.name, "definition.tsx") }))
    .filter((e) => {
      try {
        readFileSync(e.path);
        return true;
      } catch {
        return false;
      }
    })
    .map((e) => ({ name: e.name, source: readFileSync(e.path, "utf8") }));
}

test("a section that declares load() hands it to the registry", () => {
  for (const { name, source } of definitionFiles()) {
    const declares = /^(async )?function load[(<]/m.test(source) || /^const load = /m.test(source);
    if (!declares) continue;
    assert.match(source, /^ {2}load,$/m, `section "${name}" มี load() แต่ไม่ได้ใส่ไว้ใน definition — section จะไม่ได้รับข้อมูล`);
  }
});

test("every section is listed in the registry", () => {
  const registry = readFileSync(join(SECTIONS, "registry.ts"), "utf8");
  for (const { name } of definitionFiles()) {
    assert.ok(
      registry.includes(`./${name}/definition`),
      `section "${name}" มีไฟล์อยู่แต่ registry.ts ไม่ได้ import — จะไม่มีใครวาดมันได้`
    );
  }
});

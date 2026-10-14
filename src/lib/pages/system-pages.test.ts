import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GLOBAL_LIST_ALL,
  GLOBALS,
  SYSTEM_PAGE_LIST,
  SYSTEM_PAGES,
  TEMPLATE_LIST_ALL,
  TEMPLATES,
  reservedTopLevelSegments,
} from "./system-pages.ts";

// The registry is a list, and its mistakes are the mistakes lists make: two
// entries with one key, where the second quietly wins; an address typed twice
// under different names, where the editor offers two pages for one URL. None
// of those show up when you look at the file.

test("no key is used twice — the second would silently replace the first", () => {
  assert.equal(Object.keys(SYSTEM_PAGES).length, SYSTEM_PAGE_LIST.length);
  assert.equal(Object.keys(TEMPLATES).length, TEMPLATE_LIST_ALL.length);
  assert.equal(Object.keys(GLOBALS).length, GLOBAL_LIST_ALL.length);
});

test("no address is served by two pages", () => {
  const paths = SYSTEM_PAGE_LIST.map((p) => p.path).filter((p): p is string => p !== null);
  assert.equal(new Set(paths).size, paths.length);
});

test("every address is a real path, and only the 404 has none", () => {
  for (const page of SYSTEM_PAGE_LIST) {
    if (page.path === null) {
      assert.equal(page.key, "not-found", `${page.key} มี path เป็น null ทั้งที่ไม่ใช่หน้า 404`);
      continue;
    }
    assert.match(page.path, /^\/[a-z0-9/-]+$/, `${page.key} มี path ที่ไม่ใช่ที่อยู่จริง: ${page.path}`);
  }
});

test("a template exists for each kind of item a page can be about", () => {
  assert.deepEqual(
    Object.keys(TEMPLATES).sort(),
    ["article", "category", "collection", "concern", "product", "question"].sort()
  );
});

test("a template's pattern names a parameter — that is what makes it a template", () => {
  for (const template of TEMPLATE_LIST_ALL) {
    assert.match(template.pattern, /\[[a-z]+\]/, `${template.key} ไม่มีพารามิเตอร์ใน pattern`);
  }
});

test("every system address is closed to /p/ pages", () => {
  const reserved = new Set(reservedTopLevelSegments());
  for (const page of SYSTEM_PAGE_LIST) {
    if (!page.path) continue;
    const first = page.path.split("/")[1];
    assert.ok(reserved.has(first), `/p/${first} ยังสร้างทับ ${page.path} ได้`);
  }
});

test("the reserved list holds segments, not paths", () => {
  for (const segment of reservedTopLevelSegments()) {
    assert.ok(segment.length > 0);
    assert.ok(!segment.includes("/"), `"${segment}" เป็น path ไม่ใช่ segment`);
  }
});

test("waves run 1 to 5, and wave 3 is templates only", () => {
  for (const item of [...SYSTEM_PAGE_LIST, ...TEMPLATE_LIST_ALL, ...GLOBAL_LIST_ALL]) {
    assert.ok(item.wave >= 1 && item.wave <= 5, `${item.key} อยู่คลื่นที่ไม่มีจริง: ${item.wave}`);
  }
  assert.equal(
    SYSTEM_PAGE_LIST.filter((p) => p.wave === 3).length,
    0,
    "คลื่น 3 เป็นเทมเพลตล้วน ไม่ควรมีหน้าระบบ"
  );
  assert.deepEqual([...new Set(GLOBAL_LIST_ALL.map((g) => g.wave))], [5]);
});

test("the pages the plan says to leave alone are not in the registry", () => {
  // Checkout, the account forms, the LINE bridge and the campaign tools have
  // their own admin screens or must not be touched at all. A page that
  // appears here by accident is a page somebody can take apart.
  const paths = new Set(SYSTEM_PAGE_LIST.map((p) => p.path));
  for (const path of ["/checkout", "/skin-coach", "/chat", "/liff", "/track", "/glow-challenge"]) {
    assert.ok(!paths.has(path), `${path} ไม่ควรอยู่ในระบบจัดหน้า`);
  }
});

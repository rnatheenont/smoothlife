// Counts Thai written straight into the storefront's own markup.
//
// Those words are the ones an English visitor will still be reading in Thai:
// not content the team typed into the editor (that is a two-language field,
// see lib/i18n/localized.ts) and not the dictionary (lib/i18n/messages), but
// sentences baked into a component by whoever wrote it.
//
// Reports and never fails, on purpose. The shop was written in Thai first, so
// on the day this lands the number is in the hundreds — a build that refuses
// to run until all of them are moved is a build nobody can run. What it is
// for is the direction of travel: the number goes down, and a pull request
// that puts it up is visible to whoever reads the build log. The plan (§B3)
// says warning first and error later; this is the warning.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/components", "src/sections", "src/app"];
// The admin is a Thai-only tool for a Thai-speaking team. Translating it is
// not on anyone's plan, so counting it would bury the number that matters.
const SKIP = [
  "src/app/admin",
  "src/components/admin",
  "src/app/api",
  "src/lib/i18n",
];
const THAI = /[฀-๿]/;

function files(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (SKIP.some((s) => full.startsWith(s))) continue;
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Lines holding Thai that is not inside a comment. */
function thaiLines(source) {
  const out = [];
  let inBlockComment = false;
  source.split("\n").forEach((raw, i) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    const start = line.indexOf("/*");
    if (start !== -1 && line.indexOf("*/", start) === -1) {
      line = line.slice(0, start);
      inBlockComment = true;
    }
    line = line.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/, "$1");
    if (THAI.test(line)) out.push({ line: i + 1, text: line.trim() });
  });
  return out;
}

const counts = [];
let total = 0;
for (const root of ROOTS) {
  for (const file of files(root)) {
    const hits = thaiLines(readFileSync(file, "utf8"));
    if (hits.length === 0) continue;
    counts.push({ file, n: hits.length });
    total += hits.length;
  }
}

counts.sort((a, b) => b.n - a.n);
console.log(`[i18n] ภาษาไทยที่ฝังอยู่ในโค้ดหน้าร้าน: ${total} บรรทัด ใน ${counts.length} ไฟล์`);
for (const { file, n } of counts.slice(0, 15)) {
  console.log(`[i18n]   ${String(n).padStart(4)}  ${file}`);
}
if (counts.length > 15) console.log(`[i18n]   … อีก ${counts.length - 15} ไฟล์`);
console.log("[i18n] คำที่ส่วนประกอบพูดเองให้ย้ายไป src/lib/i18n/messages · เนื้อหาที่แอดมินแก้ได้ให้เป็นช่อง lText");

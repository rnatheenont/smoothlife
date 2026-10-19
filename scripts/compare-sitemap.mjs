// Checks that every address in the sitemap still answers the same way on a
// different host — the thing to run before and after moving the shop.
//
// The risk this is for (plan R1): moving to another domain is one environment
// variable and a DNS record, and both are easy. What is not easy is noticing
// that eleven of 1,164 addresses now 404, because nobody opens 1,164 pages.
// A page that quietly stops existing during a domain move loses whatever
// Google knew about it, and the first sign is a sales number a fortnight
// later that nobody can explain.
//
//   node scripts/compare-sitemap.mjs <before> <after> [options]
//   node scripts/compare-sitemap.mjs https://smoothlife.vercel.app https://app.smoothlife.com
//
//   --limit N        only the first N addresses (a quick look; default: all)
//   --concurrency N  requests in flight per side (default 6)
//   --out FILE       where to write the report (default: sitemap-compare.txt)
//
// Comparing the two HTML bodies directly would report every page as changed,
// because the host appears inside each one — in canonical tags, in links, in
// structured data. So both bodies have their own host replaced by the same
// placeholder before anything is compared. What is left is the content, and
// a difference in that is a real difference.
//
// Exit code is 1 when anything regressed, so this can gate a move.

const [, , beforeArg, afterArg, ...rest] = process.argv;

if (!beforeArg || !afterArg) {
  console.error("ใช้: node scripts/compare-sitemap.mjs <before-origin> <after-origin> [--limit N] [--concurrency N] [--out FILE]");
  process.exit(2);
}

function flag(name, fallback) {
  const i = rest.indexOf(name);
  return i === -1 ? fallback : rest[i + 1];
}

const BEFORE = beforeArg.replace(/\/$/, "");
const AFTER = afterArg.replace(/\/$/, "");
const LIMIT = Number(flag("--limit", "0")) || 0;
const CONCURRENCY = Number(flag("--concurrency", "6")) || 6;
const OUT = flag("--out", "sitemap-compare.txt");

const HOST_PLACEHOLDER = "__HOST__";

/** Every <loc> in a sitemap, following a sitemap index one level down. */
async function addressesFrom(origin) {
  const seen = new Set();
  const queue = [`${origin}/sitemap.xml`];

  while (queue.length > 0) {
    const url = queue.shift();
    const res = await fetch(url, { headers: { "user-agent": "smoothlife-sitemap-compare" } });
    if (!res.ok) throw new Error(`อ่าน ${url} ไม่ได้ — HTTP ${res.status}`);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

    if (/<sitemapindex/.test(xml)) {
      queue.push(...locs);
      continue;
    }
    for (const loc of locs) {
      try {
        seen.add(new URL(loc).pathname || "/");
      } catch {
        // A <loc> that is not a URL is the sitemap's problem, not this run's.
      }
    }
  }
  return [...seen].sort();
}

/** What one address answers, in a form the two hosts can be compared on. */
async function probe(origin, path) {
  const target = `${origin}${path}`;
  try {
    const res = await fetch(target, {
      redirect: "follow",
      headers: { "user-agent": "smoothlife-sitemap-compare" },
    });
    const body = await res.text();
    // Both hosts, and the bare host without a scheme, so a link written
    // either way collapses to the same text.
    const normalised = body
      .split(BEFORE).join(HOST_PLACEHOLDER)
      .split(AFTER).join(HOST_PLACEHOLDER)
      .split(new URL(BEFORE).host).join(HOST_PLACEHOLDER)
      .split(new URL(AFTER).host).join(HOST_PLACEHOLDER);

    return {
      status: res.status,
      // Where it ended up, without the host — a redirect to the same path on
      // the other host is the move working, not a difference.
      landed: new URL(res.url).pathname + new URL(res.url).search,
      title: (body.match(/<title>([^<]*)<\/title>/) || [, ""])[1].trim().slice(0, 80),
      size: normalised.length,
    };
  } catch (err) {
    return { status: 0, landed: "", title: "", size: 0, error: String(err.message || err) };
  }
}

/** Run `work` over `items`, a few at a time. */
async function pooled(items, size, work) {
  const out = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await work(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

const SIZE_TOLERANCE = 0.02; // 2% — a page with a clock or a stock count in it

function compare(path, a, b) {
  const problems = [];
  if (a.error) problems.push(`ฝั่งเดิมเรียกไม่ได้: ${a.error}`);
  if (b.error) problems.push(`ฝั่งใหม่เรียกไม่ได้: ${b.error}`);
  if (a.status !== b.status) problems.push(`สถานะ ${a.status} -> ${b.status}`);
  if (a.landed !== b.landed) problems.push(`ไปจบที่ ${a.landed} -> ${b.landed}`);
  if (a.title !== b.title) problems.push(`หัวเรื่อง "${a.title}" -> "${b.title}"`);
  if (a.size > 0 && b.size > 0) {
    const drift = Math.abs(a.size - b.size) / a.size;
    if (drift > SIZE_TOLERANCE) {
      problems.push(`ขนาดเนื้อหา ${a.size} -> ${b.size} (ต่าง ${(drift * 100).toFixed(1)}%)`);
    }
  }
  return problems.length === 0 ? null : { path, problems };
}

const { writeFileSync } = await import("node:fs");

console.log(`อ่าน sitemap จาก ${BEFORE} …`);
let paths = await addressesFrom(BEFORE);
console.log(`เจอ ${paths.length} ที่อยู่`);
if (LIMIT > 0 && paths.length > LIMIT) {
  paths = paths.slice(0, LIMIT);
  console.log(`ดูแค่ ${LIMIT} รายการแรก (--limit)`);
}

let done = 0;
const results = await pooled(paths, CONCURRENCY, async (path) => {
  const [a, b] = await Promise.all([probe(BEFORE, path), probe(AFTER, path)]);
  done++;
  if (done % 25 === 0 || done === paths.length) {
    process.stdout.write(`\r  ตรวจแล้ว ${done}/${paths.length}`);
  }
  return compare(path, a, b);
});
process.stdout.write("\n");

const bad = results.filter(Boolean);
const lines = [
  `เทียบ sitemap`,
  `  เดิม : ${BEFORE}`,
  `  ใหม่ : ${AFTER}`,
  `  เมื่อ: ${new Date().toISOString()}`,
  `  ตรวจ ${paths.length} ที่อยู่ · ต่างกัน ${bad.length}`,
  "",
];
for (const { path, problems } of bad) {
  lines.push(path);
  for (const p of problems) lines.push(`    - ${p}`);
}
if (bad.length === 0) lines.push("ไม่มีที่อยู่ไหนเปลี่ยนไป");

writeFileSync(OUT, lines.join("\n") + "\n");

console.log("");
console.log(`ตรวจ ${paths.length} ที่อยู่ · ต่างกัน ${bad.length}`);
for (const { path, problems } of bad.slice(0, 20)) {
  console.log(`  ${path}`);
  for (const p of problems) console.log(`      ${p}`);
}
if (bad.length > 20) console.log(`  … อีก ${bad.length - 20} รายการ ดูในไฟล์`);
console.log(`รายงานเต็มอยู่ที่ ${OUT}`);

process.exit(bad.length === 0 ? 0 : 1);

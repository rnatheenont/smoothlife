// How well the FAQ search answers a question written the way a customer
// writes it — measured through the live endpoint, not through SQL.
//
//   node scripts/faq-sentence-eval.mjs                      # against prod
//   node scripts/faq-sentence-eval.mjs http://localhost:3400
//
// SQL cannot measure this. `kb_search` takes the query's embedding as an
// argument, and a script on this machine has no Voyage key to make one, so
// every SQL run sends p_embedding = null and measures text matching alone.
// /api/faq/search embeds the query server-side, which is the whole path a
// customer's search actually takes.
//
// The cases come from kb_eval_cases (origin='manual'): two sentences per
// published answer, one containing a keyword and one deliberately avoiding
// every keyword that answer has. Reported apart, because they measure
// different things — the first is close to what the author already wrote
// down, the second is the question of whether the search works at all.
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "https://app.smoothlife.com";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1].trim().replace(/^["']|["']$/g, "");
const U = pick("SUPABASE_URL");
const K = pick("SUPABASE_SERVICE_ROLE_KEY");
if (!U || !K) {
  console.error("ต้องมี SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  process.exit(2);
}
const headers = { apikey: K, Authorization: `Bearer ${K}` };

const rest = async (path) => {
  const res = await fetch(`${U}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
};

const published = await rest("kb_articles?status=eq.published&visibility=eq.public&select=id,public_slug,keywords");
const live = new Map(published.filter((a) => a.public_slug).map((a) => [a.id, a]));

const cases = (await rest("kb_eval_cases?origin=eq.manual&select=question,expected_article_id&order=id.asc")).filter(
  (c) => live.has(c.expected_article_id)
);
if (cases.length === 0) {
  console.error("ไม่มีชุดประโยคของบทความที่ publish แล้ว");
  process.exit(1);
}

const STOP = ["set", "เซ็ต", "bundle", "gift", "line", "ไลน์", "trip", "ผ่อน"];
/** Whether the sentence contains one of the answer's own search words. */
const hasKeyword = (question, article) =>
  (article.keywords ?? []).some(
    (kw) => kw.length >= 3 && !STOP.includes(kw.toLowerCase()) && question.toLowerCase().includes(kw.toLowerCase())
  );

const groups = { "มี keyword": [], "เลี่ยง keyword": [] };
let done = 0;

for (const c of cases) {
  const article = live.get(c.expected_article_id);
  const res = await fetch(`${BASE}/api/faq/search?q=${encodeURIComponent(c.question)}`);
  const slugs = res.ok ? ((await res.json()).slugs ?? []) : [];
  const rank = slugs.indexOf(article.public_slug);

  groups[hasKeyword(c.question, article) ? "มี keyword" : "เลี่ยง keyword"].push({
    question: c.question,
    rank: rank < 0 ? null : rank + 1,
  });

  done++;
  process.stdout.write(`\r${done}/${cases.length}`);
  // The endpoint is rate limited per IP (30/min) and this is one IP.
  await new Promise((r) => setTimeout(r, 2200));
}

console.log(`\n\nวัดผ่าน ${BASE}/api/faq/search · ${cases.length} ประโยค\n`);

for (const [name, rows] of Object.entries(groups)) {
  if (rows.length === 0) continue;
  const hit = rows.filter((r) => r.rank !== null && r.rank <= 3).length;
  const first = rows.filter((r) => r.rank === 1).length;
  console.log(`${name.padEnd(16)} hit@3 ${hit}/${rows.length} = ${((hit / rows.length) * 100).toFixed(1)}% · อันดับ 1 เลย ${first}`);
}

const missed = Object.values(groups)
  .flat()
  .filter((r) => r.rank === null || r.rank > 3);
if (missed.length) {
  console.log(`\nยังหาไม่เจอ ${missed.length} ประโยค:`);
  for (const m of missed) console.log(`  ${m.rank === null ? "ไม่เจอเลย" : `อันดับ ${m.rank}`}  ${m.question}`);
}

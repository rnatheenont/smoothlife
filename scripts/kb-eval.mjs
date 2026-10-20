// How often the assistant's search puts the right answer in the top three.
//
//   node scripts/kb-eval.mjs --build          # make cases from the keywords
//   node scripts/kb-eval.mjs                  # score published articles
//   node scripts/kb-eval.mjs --include-drafts # score drafts too, before publishing
//   node scripts/kb-eval.mjs --misses         # list what it got wrong
//
// The cases are free: every FAQ arrived with the words customers actually
// type — "หน้ามัน", "เสียวฟัน", "ตาล้า" — and each of those is a question
// whose right answer is already known. Three hundred-odd tests nobody had to
// write, measuring the one thing that matters: when somebody asks, do they
// get the article that answers them.
//
// --include-drafts exists because publishing is the irreversible half. It
// reads drafts through p_statuses, which the chat never sends and which
// defaults to published only — this is a way to look before leaping, not a
// way for a draft to reach a customer.
import { register } from "node:module";

register("./kb-loader.mjs", import.meta.url);
const { KB_MIN_SCORE } = await import("../src/lib/kb.ts");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ต้องมี SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const build = process.argv.includes("--build");
const includeDrafts = process.argv.includes("--include-drafts");
const showMisses = process.argv.includes("--misses");
const TOP_N = 3;

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path} — ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

if (build) {
  const articles = await rest("kb_articles?source=eq.import&select=id,keywords&order=source_ref.asc");
  const cases = articles.flatMap((a) =>
    (a.keywords ?? []).filter(Boolean).map((k) => ({ question: k, expected_article_id: a.id, origin: "keyword" }))
  );
  await rest("kb_eval_cases?origin=eq.keyword", { method: "DELETE" });
  // In batches: three hundred rows in one body is fine, but this is the shape
  // that keeps working when the knowledge base is ten times the size.
  for (let i = 0; i < cases.length; i += 200) {
    await rest("kb_eval_cases", { method: "POST", body: JSON.stringify(cases.slice(i, i + 200)) });
  }
  console.log(`สร้างชุดทดสอบ ${cases.length} ข้อ จาก ${articles.length} บทความ`);
  process.exit(0);
}

const cases = await rest("kb_eval_cases?select=id,question,expected_article_id&order=id.asc");
if (!cases.length) {
  console.error("ยังไม่มีชุดทดสอบ — รัน --build ก่อน");
  process.exit(1);
}

const statuses = includeDrafts ? ["published", "draft"] : ["published"];
console.log(`ทดสอบ ${cases.length} คำค้น · สถานะที่ค้น: ${statuses.join(", ")} · เกณฑ์คะแนน ${KB_MIN_SCORE}`);
console.log(
  includeDrafts
    ? "หมายเหตุ: รวม draft เพื่อดูว่าถ้า publish แล้วจะแม่นแค่ไหน แชทจริงยังไม่เห็น draft\n"
    : ""
);

let hit = 0;
const misses = [];
for (const c of cases) {
  // No embedding: this machine has no Voyage key, so every score below comes
  // from text matching alone. That makes the number a floor — once the daily
  // cron embeds these chunks, meaning-based matching can only add hits.
  const rows = await rest("rpc/kb_search", {
    method: "POST",
    body: JSON.stringify({
      p_query: c.question,
      p_embedding: null,
      p_limit: TOP_N,
      p_tags: null,
      p_min_score: KB_MIN_SCORE,
      p_statuses: statuses,
    }),
  });

  // One article can own several of the top chunks; rank by article, not row.
  const ranked = [];
  for (const r of rows) if (!ranked.includes(r.article_id)) ranked.push(r.article_id);
  const rank = ranked.indexOf(c.expected_article_id);

  if (rank >= 0 && rank < TOP_N) hit++;
  else misses.push({ ...c, got: rows[0]?.title ?? "(ไม่เจออะไรเลย)" });

  await rest(`kb_eval_cases?id=eq.${c.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      last_rank: rank >= 0 ? rank + 1 : null,
      last_score: rows[0] ? Number(rows[0].score) : null,
      last_run_at: new Date().toISOString(),
    }),
  });
}

const pct = ((hit / cases.length) * 100).toFixed(1);
console.log(`hit@${TOP_N}: ${hit}/${cases.length} = ${pct}%`);

if (showMisses && misses.length) {
  console.log(`\nพลาด ${misses.length} ข้อ:`);
  const byArticle = new Map();
  for (const m of misses) byArticle.set(m.expected_article_id, [...(byArticle.get(m.expected_article_id) ?? []), m]);
  for (const [, group] of byArticle) {
    console.log(`  ${group.map((g) => g.question).join(", ").slice(0, 100)}`);
    console.log(`    ได้แทน: ${group[0].got.slice(0, 70)}`);
  }
}

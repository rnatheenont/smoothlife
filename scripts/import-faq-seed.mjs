// Loads faq-seed.json into the knowledge base as drafts.
//
//   node scripts/import-faq-seed.mjs ../faq-seed.json
//   node scripts/import-faq-seed.mjs ../faq-seed.json --dry
//
// Everything arrives as status='draft'. Twelve of the thirty-three carry
// review_flags — wording nobody has approved yet, a price written into an
// answer, a set that is not in the catalogue — and publishing those because
// the import was convenient is how a shop ends up making a claim it cannot
// stand behind. Publishing is a separate decision, made by a person, later.
//
// Re-running is safe: rows are matched on source_ref, so a second run updates
// the same thirty-three rather than making thirty-three more. Each run writes
// one kb_import_batches row and stamps every article with it, so a run can be
// found and undone as a unit.
//
// Chunking comes from src/lib/kb.ts rather than being repeated here — see
// kb-loader.mjs for why that matters.
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

register("./kb-loader.mjs", import.meta.url);

const { articleChunks } = await import("../src/lib/kb.ts");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ต้องมี SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const file = process.argv[2];
const dryRun = process.argv.includes("--dry");
if (!file) {
  console.error("ใช้: node scripts/import-faq-seed.mjs <faq-seed.json> [--dry]");
  process.exit(2);
}

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

const seed = JSON.parse(readFileSync(resolvePath(process.cwd(), file), "utf8"));
const items = Array.isArray(seed) ? seed : seed.items;
console.log(`อ่าน ${items.length} ข้อจาก ${file}`);

// Refuse before writing anything rather than half-way through: a topic the
// faq_topics table has never heard of fails on the foreign key, and finding
// that out on row nineteen leaves eighteen rows behind.
const topics = new Set((await rest("faq_topics?select=slug")).map((t) => t.slug));
const unknown = [...new Set(items.map((i) => i.topic).filter((t) => !topics.has(t)))];
if (unknown.length) {
  console.error("หัวข้อที่ยังไม่มีใน faq_topics:", unknown.join(", "));
  process.exit(1);
}

const rows = items.map((item) => ({
  source: "import",
  source_ref: item.source_ref,
  category: "faq",
  status: "draft",
  visibility: "public",
  title: item.question_th,
  content: item.answer_th,
  title_en: item.question_en ?? null,
  content_en: item.answer_en ?? null,
  keywords: item.keywords ?? [],
  topic: item.topic,
  concerns: item.concerns ?? [],
  brand_slugs: item.brands ?? [],
  product_tags: item.product_slugs ?? [],
  // public_slug is what /faq/<slug> will use. Set now so the address an
  // article will live at is decided by the document it came from, not by
  // whoever presses publish first.
  public_slug: item.public_slug ?? null,
}));

if (dryRun) {
  const flagged = items.filter((i) => (i.review_flags ?? []).length > 0);
  console.log(`ลองเฉยๆ — จะนำเข้า ${rows.length} แถว เป็น draft ทั้งหมด`);
  console.log(`ติดธงรอทีมตอบ ${flagged.length} ข้อ:`);
  for (const f of flagged) console.log(`  ${f.source_ref}  ${f.question_th.slice(0, 48)}  [${f.review_flags.join("; ").slice(0, 70)}]`);
  process.exit(0);
}

const [batch] = await rest("kb_import_batches", {
  method: "POST",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify([{ source: "json", file_name: file, counts: {} }]),
});
console.log(`batch ${batch.id}`);

let saved;
try {
  // Upserted by hand rather than with on_conflict=source_ref.
  //
  // The unique index this relies on is a partial one — unique among imported
  // rows only, because source_ref on the older articles holds the page they
  // came from (/help appears five times) and is not unique by design. Postgres
  // will not infer a partial index from ON CONFLICT, so PostgREST answers
  // 42P10 and the whole batch fails. Reading first and splitting is longer to
  // write and does the same thing.
  const refs = rows.map((r) => r.source_ref);
  const existing = await rest(
    `kb_articles?source=eq.import&source_ref=in.(${refs.map((r) => `"${r}"`).join(",")})&select=id,source_ref`
  );
  const idByRef = new Map(existing.map((e) => [e.source_ref, e.id]));

  const fresh = rows.filter((r) => !idByRef.has(r.source_ref));
  const again = rows.filter((r) => idByRef.has(r.source_ref));

  const inserted = fresh.length
    ? await rest("kb_articles", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(fresh.map((r) => ({ ...r, import_batch_id: batch.id }))),
      })
    : [];

  const updated = [];
  for (const row of again) {
    const [one] = await rest(`kb_articles?id=eq.${idByRef.get(row.source_ref)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      // status is left alone on purpose: re-importing must never pull a
      // published answer back to draft, or quietly republish one a person
      // took down.
      body: JSON.stringify({ ...row, status: undefined, import_batch_id: batch.id }),
    });
    updated.push(one);
  }

  saved = [...inserted, ...updated];
  console.log(`เขียน ${saved.length} แถว (ใหม่ ${inserted.length} · อัปเดต ${updated.length})`);
} catch (err) {
  // Without this the failed run leaves a batch row claiming an import that
  // never happened, and the next person reading the list cannot tell.
  await rest(`kb_import_batches?id=eq.${batch.id}`, { method: "DELETE" }).catch(() => {});
  throw err;
}

// Chunks are written here rather than left to a later reindex, so the search
// words arrive with the article. Embeddings are not: this machine has no
// Voyage key, and the daily cron gives one to anything still without.
let chunks = 0;
for (const article of saved) {
  const pieces = articleChunks(article);
  await rest(`kb_chunks?article_id=eq.${article.id}`, { method: "DELETE" });
  await rest("kb_chunks", {
    method: "POST",
    body: JSON.stringify(pieces.map((text, i) => ({ article_id: article.id, chunk_index: i, chunk_text: text, embedding: null }))),
  });
  chunks += pieces.length;
}
console.log(`เขียน ${chunks} chunk (ยังไม่มี embedding — cron รายวันจะเติมให้)`);

await rest(`kb_import_batches?id=eq.${batch.id}`, {
  method: "PATCH",
  body: JSON.stringify({ counts: { rows: saved.length, chunks, flagged: items.filter((i) => (i.review_flags ?? []).length > 0).length } }),
});

console.log("เสร็จ — ทุกข้อเป็น draft ยังไม่มีอะไรขึ้นหน้าเว็บหรือเข้าแชท");

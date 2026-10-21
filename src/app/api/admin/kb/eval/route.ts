import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { searchKb, KB_MIN_SCORE } from "@/lib/kb";

// Does the search find the right answer?
//
// The cases are free: every FAQ arrived with the words customers actually
// type, and each of those is a question whose correct answer is already
// known. Three hundred-odd tests nobody had to write, measuring the one
// thing that matters — when somebody asks, do they get the article that
// answers them.
//
// Two sets, reported apart, because they measure different things and
// averaging them hides the one that is failing:
//
//   keyword  — the short words the author listed. Generous by construction:
//              it is the article being asked about itself.
//   sentence — written as a customer would type it. This is the number that
//              says whether the search works.
//
// Nothing here writes an article, and the run is read-only apart from
// stamping each case with how it did, so the page can show what changed.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

const TOP_N = 3;
/** One request at a time would take minutes; the embedding provider's limit
 *  is per minute, so a handful in parallel is both faster and still polite. */
const CONCURRENCY = 4;

type Case = { id: number; question: string; expected_article_id: string; origin: string };

async function rank(question: string, expected: string): Promise<number | null> {
  // Retries here, unlike the customer-facing search: this run exists to
  // measure how good the answers are, and an embedding refused by the rate
  // limit would be scored as a bad answer rather than as a missing one.
  const matches = await searchKb(question, 12, undefined, KB_MIN_SCORE, 3);
  const order: string[] = [];
  for (const m of matches) if (!order.includes(m.article_id)) order.push(m.article_id);
  const at = order.indexOf(expected);
  return at < 0 ? null : at + 1;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const cases = await supabaseRest<(Case & { last_rank: number | null; last_run_at: string | null })[]>(
    "kb_eval_cases?select=id,question,expected_article_id,origin,last_rank,last_run_at&order=id.asc&limit=1000"
  );

  return NextResponse.json({
    ok: true,
    cases: cases.length,
    byOrigin: summarise(cases),
    lastRunAt: cases.map((c) => c.last_run_at).filter(Boolean).sort().at(-1) ?? null,
  });
}

/** Run it. POST because it costs embedding requests and takes a while. */
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  // Only cases whose expected article is published: the chat cannot return a
  // draft, so scoring against one measures nothing and drags the number down
  // for a reason that has nothing to do with the search.
  const published = await supabaseRest<{ id: string }[]>(
    "kb_articles?status=eq.published&select=id&limit=1000"
  );
  const live = new Set(published.map((p) => p.id));

  const all = await supabaseRest<Case[]>(
    "kb_eval_cases?select=id,question,expected_article_id,origin&order=id.asc&limit=1000"
  );
  const cases = all.filter((c) => live.has(c.expected_article_id));
  if (cases.length === 0) {
    return NextResponse.json({ ok: false, error: "ยังไม่มีชุดทดสอบของบทความที่ publish แล้ว" }, { status: 400 });
  }

  const results: (Case & { rank: number | null })[] = [];
  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    const slice = cases.slice(i, i + CONCURRENCY);
    const ranked = await Promise.all(
      slice.map(async (c) => ({ ...c, rank: await rank(c.question, c.expected_article_id).catch(() => null) }))
    );
    results.push(...ranked);
  }

  const now = new Date().toISOString();
  for (const r of results) {
    await supabaseRest(`kb_eval_cases?id=eq.${pgValue(String(r.id))}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ last_rank: r.rank, last_run_at: now }),
    }).catch(() => {});
  }

  const misses = results
    .filter((r) => r.rank === null || r.rank > TOP_N)
    .slice(0, 40)
    .map((r) => ({ question: r.question, origin: r.origin, rank: r.rank }));

  return NextResponse.json({
    ok: true,
    ranAt: now,
    byOrigin: summarise(results.map((r) => ({ ...r, last_rank: r.rank }))),
    misses,
    skipped: all.length - cases.length,
  });
}

function summarise(rows: { origin: string; last_rank: number | null }[]) {
  const groups = new Map<string, { cases: number; hit: number; first: number }>();
  for (const r of rows) {
    const g = groups.get(r.origin) ?? { cases: 0, hit: 0, first: 0 };
    g.cases++;
    if (r.last_rank !== null && r.last_rank <= TOP_N) g.hit++;
    if (r.last_rank === 1) g.first++;
    groups.set(r.origin, g);
  }
  return [...groups.entries()].map(([origin, g]) => ({
    origin,
    cases: g.cases,
    hit: g.hit,
    first: g.first,
    pct: g.cases === 0 ? 0 : Math.round((g.hit / g.cases) * 1000) / 10,
  }));
}

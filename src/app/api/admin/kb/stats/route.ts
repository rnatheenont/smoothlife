import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// Whether the FAQ centre is working, in five numbers.
//
// Each one answers a question somebody actually asks about it: which answers
// people read, which ones they found useless, what they search for, what they
// search for and do not find, and how often the assistant had an approved
// answer to give. Anything that did not answer one of those is not here.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

const DAYS = 30;

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [articles, searches, gaps, answers] = await Promise.all([
    supabaseRest<{ title: string; public_slug: string | null; helpful_count: number | null; not_helpful_count: number | null }[]>(
      "kb_articles?status=eq.published&visibility=eq.public&select=title,public_slug,helpful_count,not_helpful_count&limit=500"
    ).catch(() => []),
    supabaseRest<{ normalized: string; results: number }[]>(
      `search_queries?scope=eq.faq&created_at=gte.${encodeURIComponent(since)}&select=normalized,results&limit=5000`
    ).catch(() => []),
    supabaseRest<{ question: string; hits: number | null }[]>(
      "kb_gaps?status=eq.open&select=question,hits&order=hits.desc&limit=10"
    ).catch(() => []),
    supabaseRest<{ was_escalated: boolean; tools: unknown }[]>(
      `ai_conversation_log?created_at=gte.${encodeURIComponent(since)}&select=was_escalated,tools&limit=5000`
    ).catch(() => []),
  ]);

  // Most and least useful, by what readers said rather than by what anybody
  // assumed. Only answers somebody actually voted on: a question with no
  // votes is not "neutral", it is unmeasured, and mixing the two would put
  // the newest answers at the bottom of a list titled "least helpful".
  const voted = articles
    .map((a) => ({
      title: a.title,
      slug: a.public_slug,
      up: a.helpful_count ?? 0,
      down: a.not_helpful_count ?? 0,
    }))
    .filter((a) => a.up + a.down > 0);

  const counts = new Map<string, { hits: number; empty: number }>();
  for (const s of searches) {
    const row = counts.get(s.normalized) ?? { hits: 0, empty: 0 };
    row.hits++;
    if (s.results === 0) row.empty++;
    counts.set(s.normalized, row);
  }
  const popular = [...counts.entries()]
    .map(([q, c]) => ({ q, ...c }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 10);

  // How often a turn had an approved answer behind it.
  //
  // `tools` is empty on a turn where the assistant never searched at all, and
  // those are counted apart: "did not ask" and "asked and found nothing" are
  // different failures with different fixes, and one number covering both
  // would point at the wrong one.
  const turns = answers.length;
  const askedKb = answers.filter((a) => Array.isArray(a.tools) && (a.tools as { name?: string }[]).some((t) => t?.name === "search_knowledge_base"));
  const found = askedKb.filter((a) => !a.was_escalated);

  return NextResponse.json({
    ok: true,
    days: DAYS,
    helpful: [...voted].sort((a, b) => b.up - a.up).slice(0, 8),
    unhelpful: [...voted].sort((a, b) => b.down - a.down).filter((a) => a.down > 0).slice(0, 8),
    popular,
    gaps: gaps.map((g) => ({ q: g.question, hits: g.hits ?? 1 })),
    assistant: {
      turns,
      askedKb: askedKb.length,
      answeredFromKb: found.length,
      pct: askedKb.length === 0 ? null : Math.round((found.length / askedKb.length) * 1000) / 10,
    },
  });
}

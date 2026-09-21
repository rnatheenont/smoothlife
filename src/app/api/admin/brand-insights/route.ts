import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { buildBrandInsight } from "@/lib/brand-insight";
import { computeOpportunities, type OpportunityRow } from "@/lib/seo-opportunity";

// The dashboard's data, and the two jobs that produce it. Both jobs are
// manual for now: they cost an AI call and a few dozen Trends requests, and
// nobody should discover either by loading a page.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type InsightRow = {
  id: string;
  period_start: string;
  period_end: string;
  summary: string | null;
  positive_themes: string[] | null;
  negative_themes: string[] | null;
  recommendations: string[] | null;
  signals_considered: number;
  created_at: string;
};

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [insights, opportunities, sentiment] = await Promise.all([
    supabaseRest<InsightRow[]>("brand_insights?select=*&order=created_at.desc&limit=5").catch((): InsightRow[] => []),
    supabaseRest<OpportunityRow[]>(
      "seo_opportunity_scores?select=*&order=opportunity_percent.desc&limit=60"
    ).catch((): OpportunityRow[] => []),
    supabaseRest<{ sentiment: string | null }[]>(
      "brand_signals?signal_type=eq.review&select=sentiment&limit=2000"
    ).catch((): { sentiment: string | null }[] => []),
  ]);

  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const row of sentiment) {
    if (row.sentiment === "positive") counts.positive += 1;
    else if (row.sentiment === "negative") counts.negative += 1;
    else if (row.sentiment === "neutral") counts.neutral += 1;
  }

  return NextResponse.json({ ok: true, insights, opportunities, sentiment: counts });
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const job = req.nextUrl.searchParams.get("job");

  if (job === "score") {
    const rows = await computeOpportunities();
    return NextResponse.json({ ok: true, scored: rows.length });
  }
  if (job === "insight") {
    // strictNullChecks is off in this tsconfig, which stops a boolean
    // discriminant narrowing a union (see the note in admin/users) — check
    // the field that only exists on the failure shape instead.
    const result = await buildBrandInsight();
    if ("error" in result) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, insight: result.insight });
  }
  return NextResponse.json({ ok: false, error: "ไม่รู้จักงานนี้" }, { status: 400 });
}

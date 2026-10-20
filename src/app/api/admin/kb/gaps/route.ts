import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { clusterGaps, type GapRow } from "@/lib/kb-gaps-cluster";

// The queue: questions customers asked that the shop has no answer for,
// most-asked first.
//
// The groups come back alongside the rows rather than applied to them. A
// group judged only on how the words look is a suggestion — see the note on
// NEAR_BY_TEXT for the measurements that made that the rule — so the screen
// shows it and a person decides.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

const COLUMNS = "id,question,examples,hits,sources,status,article_id,first_seen,last_seen";

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const rows = await supabaseRest<GapRow[]>(
    `kb_gaps?status=eq.${encodeURIComponent(status)}&select=${COLUMNS}&order=hits.desc,last_seen.desc&limit=300`
  );

  // The embeddings are read separately and only for grouping: they are a
  // thousand numbers a row and have no business crossing the wire to a
  // browser that is going to render a list of questions.
  const vectors = await supabaseRest<{ id: string; embedding: number[] | null }[]>(
    `kb_gaps?status=eq.${encodeURIComponent(status)}&select=id,embedding&limit=300`
  ).catch((): { id: string; embedding: number[] | null }[] => []);
  const byId = new Map(vectors.map((v) => [v.id, v.embedding]));

  const clusters = clusterGaps(rows.map((r) => ({ ...r, embedding: byId.get(r.id) ?? null })));

  return NextResponse.json({
    ok: true,
    gaps: rows,
    // Only what a person has to act on, in the shape the screen asks about:
    // which row stays, which fold in, and whether it may be done unasked.
    suggestions: clusters.map((c) => ({
      keepId: c.keep.id,
      keepQuestion: c.keep.question,
      mergeIds: c.merge.map((m) => m.id),
      mergeQuestions: c.merge.map((m) => m.question),
      hits: c.merged.hits,
      confident: c.confident,
    })),
    embedded: vectors.filter((v) => v.embedding).length,
  });
}

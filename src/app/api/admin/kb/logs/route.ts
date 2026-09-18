import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// Admin: what the assistant answered, and which approved articles it used.
// The two things this is for: checking a claim in a transcript against the
// article behind it, and finding the questions the base cannot answer yet —
// those are the next articles to write.
export const dynamic = "force-dynamic";

const PAGE = 50;

export type AiLogRow = {
  id: string;
  created_at: string;
  channel: string;
  customer_id: string | null;
  question: string;
  ai_answer: string | null;
  matched_article_ids: string[];
  was_escalated: boolean;
  staff_correction: string | null;
};

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const page = Math.max(0, Number(req.nextUrl.searchParams.get("page") ?? 0) || 0);
  const filter = req.nextUrl.searchParams.get("filter");
  // "unanswered" is the useful view: a question the knowledge base had nothing for.
  const where = filter === "unanswered" ? "&matched_article_ids=eq.{}" : filter === "answered" ? "&matched_article_ids=neq.{}" : "";

  const rows = await supabaseRest<AiLogRow[]>(
    `ai_conversation_log?select=id,created_at,channel,customer_id,question,ai_answer,matched_article_ids,was_escalated,staff_correction${where}&order=created_at.desc&limit=${PAGE}&offset=${page * PAGE}`
  );

  // The titles of every article these answers leant on, in one read.
  const ids = [...new Set(rows.flatMap((r) => r.matched_article_ids))];
  const titles = ids.length
    ? await supabaseRest<{ id: string; title: string }[]>(`kb_articles?id=in.(${ids.join(",")})&select=id,title`).catch(() => [])
    : [];

  return NextResponse.json({
    ok: true,
    rows,
    titles: Object.fromEntries(titles.map((t) => [t.id, t.title])),
    hasMore: rows.length === PAGE,
  });
}

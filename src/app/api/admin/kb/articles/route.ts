import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { KB_COLUMNS, parseArticleInput, reindexArticle, type KbArticle } from "@/lib/kb";

// Admin: the AI knowledge base — the articles the assistant is allowed to
// answer from. Writing one also rewrites its chunks, so retrieval never sees a
// version of an article that no longer exists.
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const articles = await supabaseRest<KbArticle[]>(`kb_articles?select=${KB_COLUMNS}&order=updated_at.desc&limit=500`);
  const counts = articles.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});
  return NextResponse.json({ ok: true, articles, counts, embeddings: Boolean(process.env.VOYAGE_API_KEY) });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const body = await req.json().catch(() => null);
  const parsed = parseArticleInput(body);
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const source = (body as Record<string, unknown>)?.source;
  const [article] = await supabaseRest<KbArticle[]>(`kb_articles?select=${KB_COLUMNS}`, {
    method: "POST",
    body: JSON.stringify({ ...parsed.row, source: source === "chat_promoted" ? "chat_promoted" : "manual" }),
  });
  await reindexArticle(article);
  return NextResponse.json({ ok: true, article });
}

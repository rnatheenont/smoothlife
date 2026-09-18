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

  // Once the catalogue is synced the product articles outnumber everything a
  // person wrote by a hundred to one, so the screen opens on what the team
  // maintains and asks for the product ones by name.
  const source = req.nextUrl.searchParams.get("source") ?? "curated";
  const filter =
    source === "shopify_sync"
      ? "&source=eq.shopify_sync"
      : source === "all"
        ? ""
        : "&source=in.(manual,chat_promoted)";

  const articles = await supabaseRest<KbArticle[]>(`kb_articles?select=${KB_COLUMNS}${filter}&order=updated_at.desc&limit=300`);
  const bySource = await supabaseRest<{ source: string }[]>("kb_articles?select=source&limit=5000").catch((): { source: string }[] => []);
  const sourceCounts = bySource.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.source]: (acc[a.source] ?? 0) + 1 }), {});
  const counts = articles.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});

  return NextResponse.json({
    ok: true,
    articles,
    counts,
    sourceCounts,
    truncated: articles.length === 300,
    embeddings: Boolean(process.env.VOYAGE_API_KEY),
  });
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

import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { reindexArticle, type KbArticle } from "@/lib/kb";

// Rebuild the search index for existing articles. Needed once, the day an
// embedding provider is configured: everything written before that was stored
// as text-only chunks, and nothing rewrites them until someone edits the
// article. Walks in slices so a few hundred articles cannot run into a
// request timeout.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH = 40;

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!process.env.VOYAGE_API_KEY) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า VOYAGE_API_KEY — ตอนนี้ค้นหาด้วยการจับคู่ข้อความอยู่แล้ว ไม่ต้องสร้าง embedding" }, { status: 400 });
  }

  // Only what is missing: an article whose chunks already carry embeddings
  // does not need paying for again.
  const pending = await supabaseRest<{ article_id: string }[]>("kb_chunks?embedding=is.null&select=article_id&limit=5000");
  const ids = [...new Set(pending.map((c) => c.article_id))];
  if (ids.length === 0) return NextResponse.json({ ok: true, indexed: 0, total: 0, nextOffset: null });

  const slice = ids.slice(0, BATCH);
  for (const id of slice) {
    const [article] = await supabaseRest<Pick<KbArticle, "id" | "title" | "content">[]>(
      `kb_articles?id=eq.${pgValue(id)}&select=id,title,content`
    );
    if (article) await reindexArticle(article);
  }

  // The caller asks again until nothing is left; each round re-reads what is
  // still missing, so finishing is not a matter of counting offsets right.
  return NextResponse.json({ ok: true, indexed: slice.length, total: ids.length, nextOffset: ids.length > slice.length ? 0 : null });
}

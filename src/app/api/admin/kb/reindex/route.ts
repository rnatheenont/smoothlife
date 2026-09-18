import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
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

  const body = (await req.json().catch(() => null)) as { offset?: number } | null;
  const offset = Number.isInteger(body?.offset) && (body?.offset ?? 0) >= 0 ? (body!.offset as number) : 0;

  const [{ count } = { count: 0 }] = await supabaseRest<{ count: number }[]>("kb_articles?select=count");
  const articles = await supabaseRest<Pick<KbArticle, "id" | "title" | "content">[]>(
    `kb_articles?select=id,title,content&order=created_at.asc&limit=${BATCH}&offset=${offset}`
  );
  for (const article of articles) await reindexArticle(article);

  const done = offset + BATCH >= Number(count);
  return NextResponse.json({ ok: true, indexed: articles.length, total: Number(count), nextOffset: done ? null : offset + BATCH });
}

import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CHUNK_COLUMNS, reindexArticles, type ChunkableRow, type KbArticle } from "@/lib/kb";

// Rebuild the search index for existing articles. Needed once, the day an
// embedding provider is configured: everything written before that was stored
// as text-only chunks, and nothing rewrites them until someone edits the
// article. Walks in slices so a few hundred articles cannot run into a
// request timeout.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Each round is one embedding request or two; the free tier allows three a
// minute, so the page walks rounds rather than one long request.
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
  const pending = await supabaseRest<{ article_id: string; kb_articles: { source: string } }[]>(
    "kb_chunks?embedding=is.null&select=article_id,kb_articles!inner(source)&kb_articles.status=eq.published&limit=5000"
  );
  const ids = [
    ...new Set(
      [...pending]
        .map((c) => c.article_id)
    ),
  ];
  // Logged, because the last time this was pressed nobody could tell
  // afterwards whether it had found no work, been refused by the provider, or
  // written something that was then overwritten. The route said nothing at
  // all, so the only evidence was a screenshot of a toast.
  console.info(`[kb/reindex] pending chunks=${pending.length} articles=${ids.length}`);
  if (ids.length === 0) return NextResponse.json({ ok: true, indexed: 0, total: 0, nextOffset: null });

  const slice = ids.slice(0, BATCH);
  // CHUNK_COLUMNS, not a hand-written three. Selecting only id, title and
  // content type-checks and runs, and rebuilds the chunk from the Thai title
  // and answer alone — no search words, no English, no topic. See the note on
  // CHUNK_COLUMNS: that is not a hypothetical, it is what this route did to
  // all twenty-one published answers.
  const articles = await supabaseRest<ChunkableRow[]>(
    `kb_articles?id=in.(${slice.map(pgValue).join(",")})&select=${CHUNK_COLUMNS}`
  );
  const result = await reindexArticles(articles);
  console.info(
    `[kb/reindex] asked=${slice.length} read=${articles.length} chunks=${result.chunks} embedded=${result.embedded}`
  );

  // The caller asks again until nothing is left; each round re-reads what is
  // still missing, so finishing is not a matter of counting offsets right.
  // If the provider refused (rate limit, outage), say so instead of looping
  // over the same articles writing text-only chunks for ever.
  if (!result.embedded) {
    return NextResponse.json(
      { ok: false, error: "ผู้ให้บริการ embedding ปฏิเสธคำขอ (อาจติดลิมิตต่อนาที) — รอสักครู่แล้วกดใหม่ ระบบจะทำต่อจากที่ค้างไว้" },
      { status: 503 }
    );
  }

  // Counted from the database rather than from what this request believes it
  // did. "I wrote 21" and "21 rows now have an embedding" are different
  // claims, and only the second one is worth showing to the person who
  // pressed the button.
  const left = await supabaseRest<{ article_id: string }[]>(
    "kb_chunks?embedding=is.null&select=article_id,kb_articles!inner(id)&kb_articles.status=eq.published&limit=5000"
  ).catch((): { article_id: string }[] => []);
  const remaining = new Set(left.map((c) => c.article_id)).size;
  console.info(`[kb/reindex] remaining articles without embeddings=${remaining}`);

  return NextResponse.json({
    ok: true,
    indexed: slice.length,
    total: ids.length,
    chunks: result.chunks,
    remaining,
    nextOffset: remaining > 0 && remaining < ids.length ? 0 : null,
  });
}

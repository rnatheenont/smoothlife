import { NextRequest, NextResponse } from "next/server";
import { kbDraftChanged } from "@/lib/faq-changed";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CHUNK_COLUMNS, reindexArticle, type ChunkableRow } from "@/lib/kb";

// What an admin does with one question from the queue.
//
// Four actions, and three of them are not "write an answer":
//
//   dismiss  — not a question this shop answers
//   link     — the answer exists, the search could not find it from these
//              words, so the words become search words on that answer
//   merge    — several rows are one question
//   draft    — there is no answer; open the editor with the question in it
//
// `link` is the one worth naming. A queue that only offers "write an answer"
// turns every retrieval failure into a second article saying what the first
// already said, and the shop ends up with two answers to maintain and a
// search that now has to choose between them.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

type Action =
  | { action: "dismiss" }
  | { action: "link"; articleId: string }
  | { action: "merge"; mergeIds: string[] };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบคำถามนี้" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Partial<Action> | null;

  const [gap] = await supabaseRest<{ id: string; question: string; examples: string[] | null; hits: number | null; sources: string[] | null }[]>(
    `kb_gaps?id=eq.${pgValue(id)}&select=id,question,examples,hits,sources&limit=1`
  );
  if (!gap) return NextResponse.json({ ok: false, error: "ไม่พบคำถามนี้" }, { status: 404 });

  if (body?.action === "dismiss") {
    await supabaseRest(`kb_gaps?id=eq.${pgValue(id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "dismissed" }),
    });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "link") {
    const articleId = typeof body.articleId === "string" ? body.articleId : "";
    if (!/^[0-9a-f-]{36}$/i.test(articleId)) {
      return NextResponse.json({ ok: false, error: "ไม่พบบทความที่เลือก" }, { status: 400 });
    }

    const [article] = await supabaseRest<(ChunkableRow & { keywords: string[] | null })[]>(
      `kb_articles?id=eq.${pgValue(articleId)}&select=${CHUNK_COLUMNS}&limit=1`
    );
    if (!article) return NextResponse.json({ ok: false, error: "ไม่พบบทความที่เลือก" }, { status: 404 });

    // Every wording that was asked becomes a search word, not just the
    // normalised one — the normalised form is the grouping key, and the
    // wordings are what the next customer will actually type.
    const words = [...new Set([...(article.keywords ?? []), gap.question, ...(gap.examples ?? [])])]
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 60);

    const [updated] = await supabaseRest<ChunkableRow[]>(
      `kb_articles?id=eq.${pgValue(articleId)}&select=${CHUNK_COLUMNS}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ keywords: words }),
      }
    );

    // Immediately, not at 04:30: the point of linking is that the next person
    // who asks gets the answer, and the chunk is where the search looks.
    if (updated) await reindexArticle(updated);

    await supabaseRest(`kb_gaps?id=eq.${pgValue(id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "answered", article_id: articleId }),
    });

    // Filing a gap against an answer that already exists changes no page.
    kbDraftChanged();
    return NextResponse.json({ ok: true, keywords: words.length });
  }

  if (body?.action === "merge") {
    const mergeIds = Array.isArray(body.mergeIds)
      ? body.mergeIds.filter((m): m is string => typeof m === "string" && /^[0-9a-f-]{36}$/i.test(m))
      : [];
    if (mergeIds.length === 0) return NextResponse.json({ ok: false, error: "ไม่มีข้อให้รวม" }, { status: 400 });

    const others = await supabaseRest<{ id: string; hits: number | null; examples: string[] | null; sources: string[] | null }[]>(
      `kb_gaps?id=in.(${mergeIds.map(pgValue).join(",")})&select=id,hits,examples,sources`
    );

    const all = [gap, ...others];
    await supabaseRest(`kb_gaps?id=eq.${pgValue(id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        hits: all.reduce((n, r) => n + (r.hits ?? 0), 0),
        examples: [...new Set(all.flatMap((r) => r.examples ?? []))].slice(-10),
        sources: [...new Set(all.flatMap((r) => r.sources ?? []))],
      }),
    });

    // The folded rows are marked, not deleted. A merge somebody regrets is
    // then a row to reopen rather than a question to remember from memory.
    await supabaseRest(`kb_gaps?id=in.(${others.map((o) => pgValue(o.id)).join(",")})`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "merged", article_id: null }),
    });

    return NextResponse.json({ ok: true, merged: others.length });
  }

  return NextResponse.json({ ok: false, error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
}

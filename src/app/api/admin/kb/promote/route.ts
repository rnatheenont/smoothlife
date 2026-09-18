import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { KB_COLUMNS, reindexArticle, type KbArticle, type KbCategory } from "@/lib/kb";

// "เพิ่มเข้าฐานความรู้" from a thread: the question a customer actually asked
// and the answer the team actually gave — the most valuable source there is,
// because both halves are real and the answer already passed a person.
//
// It always lands as a draft. An answer written for one customer often carries
// something specific to them ("ออเดอร์ของคุณ…"), so someone edits and
// publishes it deliberately; nothing here reaches a customer unread.
export const dynamic = "force-dynamic";

const CATEGORIES: KbCategory[] = ["faq", "policy", "product", "ingredient", "loyalty", "shipping", "payment"];

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  if (!answer) return NextResponse.json({ ok: false, error: "ไม่มีเนื้อหาคำตอบให้บันทึก" }, { status: 400 });

  const category = CATEGORIES.includes(body?.category as KbCategory) ? (body?.category as KbCategory) : "faq";
  const title = (question || answer).replace(/\s+/g, " ").slice(0, 120);
  const sourceRef = typeof body?.conversationId === "string" ? body.conversationId.slice(0, 100) : null;

  const [article] = await supabaseRest<KbArticle[]>(`kb_articles?select=${KB_COLUMNS}`, {
    method: "POST",
    body: JSON.stringify({
      title,
      // The question is kept with the answer: it is how a customer phrases the
      // problem, which is what the search has to match.
      content: question ? `คำถามจากลูกค้า: ${question}\n\n${answer}` : answer,
      category,
      status: "draft",
      source: "chat_promoted",
      source_ref: sourceRef,
    }),
  });
  await reindexArticle(article);
  return NextResponse.json({ ok: true, article });
}

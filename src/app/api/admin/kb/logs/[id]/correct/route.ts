import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { UUID_RE } from "@/lib/flash-sale";
import { KB_COLUMNS, reindexArticle, type KbArticle, type KbCategory } from "@/lib/kb";

// Closing the loop on a wrong answer: the correction is kept with the answer
// it corrects (so the log shows what the assistant got wrong, not just that
// someone disagreed), and the same text becomes a draft article — the reason
// the answer was wrong is almost always that nothing covered the question.
//
// The article is a draft, like everything promoted from a real exchange: it
// was written about one customer's case and someone reads it before it can be
// said to anyone else.
export const dynamic = "force-dynamic";

const CATEGORIES: KbCategory[] = ["faq", "policy", "product", "ingredient", "loyalty", "shipping", "payment"];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบรายการ" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const correction = typeof body?.correction === "string" ? body.correction.trim() : "";
  if (!correction) return NextResponse.json({ ok: false, error: "กรุณาใส่คำตอบที่ถูกต้อง" }, { status: 400 });
  const category = CATEGORIES.includes(body?.category as KbCategory) ? (body?.category as KbCategory) : "faq";

  const [log] = await supabaseRest<{ id: string; question: string }[]>(
    `ai_conversation_log?id=eq.${pgValue(id)}&select=id,question`,
    { method: "PATCH", body: JSON.stringify({ staff_correction: correction }) }
  );
  if (!log) return NextResponse.json({ ok: false, error: "ไม่พบรายการ" }, { status: 404 });

  const [article] = await supabaseRest<KbArticle[]>(`kb_articles?select=${KB_COLUMNS}`, {
    method: "POST",
    body: JSON.stringify({
      title: log.question.replace(/\s+/g, " ").slice(0, 120),
      content: `คำถามจากลูกค้า: ${log.question}\n\n${correction}`,
      category,
      status: "draft",
      source: "chat_promoted",
      source_ref: `ai_log:${log.id}`,
    }),
  });
  await reindexArticle(article);

  return NextResponse.json({ ok: true, article });
}

import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { KB_COLUMNS, parseArticleInput, reindexArticle, type KbArticle } from "@/lib/kb";
import { UUID_RE } from "@/lib/flash-sale";

// Admin: edit or remove one knowledge-base article.
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบบทความ" }, { status: 404 });

  const parsed = parseArticleInput(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const [article] = await supabaseRest<KbArticle[]>(`kb_articles?id=eq.${pgValue(id)}&select=${KB_COLUMNS}`, {
    method: "PATCH",
    body: JSON.stringify(parsed.row),
  });
  if (!article) return NextResponse.json({ ok: false, error: "ไม่พบบทความ" }, { status: 404 });
  await reindexArticle(article);
  return NextResponse.json({ ok: true, article });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบบทความ" }, { status: 404 });
  // kb_chunks cascades with the article.
  await supabaseRest(`kb_articles?id=eq.${pgValue(id)}`, { method: "DELETE", returning: false });
  return NextResponse.json({ ok: true });
}

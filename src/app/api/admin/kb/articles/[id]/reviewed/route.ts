import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { UUID_RE } from "@/lib/flash-sale";
import { KB_COLUMNS, type KbArticle } from "@/lib/kb";

// "ยังถูกต้องอยู่" — the whole review, when nothing needs changing. Editing an
// article already stamps it; this is for the far more common case where
// someone reads it, agrees with it, and the only thing that should change is
// the date it was last confirmed.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบบทความ" }, { status: 404 });

  const [article] = await supabaseRest<KbArticle[]>(`kb_articles?id=eq.${pgValue(id)}&select=${KB_COLUMNS}`, {
    method: "PATCH",
    body: JSON.stringify({ last_reviewed_at: new Date().toISOString(), reviewed_by: "admin" }),
  });
  if (!article) return NextResponse.json({ ok: false, error: "ไม่พบบทความ" }, { status: 404 });
  return NextResponse.json({ ok: true, article });
}

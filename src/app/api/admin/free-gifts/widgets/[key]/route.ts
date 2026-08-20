import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { WidgetRow } from "@/app/api/free-gifts/widgets/route";

export async function PATCH(req: NextRequest, { params }: { params: { key: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.config && typeof body.config === "object") patch.config = body.config;

  const [row] = await supabaseRest<WidgetRow[]>(`free_gift_widgets?key=eq.${params.key}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบ widget นี้" }, { status: 404 });
  return NextResponse.json({ ok: true, widget: row });
}

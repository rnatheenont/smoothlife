import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { widgetDefault, type WidgetRow } from "@/lib/widget-defaults";
import { WIDGETS_MOVED_TO_PAGES, widgetIsReadOnly } from "@/lib/pages/moved-widgets";

export async function PATCH(req: NextRequest, props: { params: Promise<{ key: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  // The real lock, not the disabled button in the panel: once the page
  // system serves the home page, nothing reads these rows, so a write here
  // would be a change that looks saved and does nothing.
  if (widgetIsReadOnly(params.key)) {
    const moved = WIDGETS_MOVED_TO_PAGES[params.key];
    return NextResponse.json(
      {
        ok: false,
        error: `ย้ายไปตั้งค่าที่หน้าเว็บ → ${moved.page} → section "${moved.section}" แล้ว`,
      },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.config && typeof body.config === "object") patch.config = body.config;

  const [row] = await supabaseRest<WidgetRow[]>(`free_gift_widgets?key=eq.${pgValue(params.key)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (row) return NextResponse.json({ ok: true, widget: row });

  // A widget the code knows about but the table has never held: the admin
  // can see it (the read route fills gaps from the same list) so switching
  // it on has to work, not 404. Anything not in that list really is unknown.
  const fallback = widgetDefault(params.key);
  if (!fallback) return NextResponse.json({ ok: false, error: "ไม่พบ widget นี้" }, { status: 404 });

  const [created] = await supabaseRest<WidgetRow[]>("free_gift_widgets", {
    method: "POST",
    body: JSON.stringify({ ...fallback, ...patch, key: params.key, label_th: fallback.label_th }),
  });
  return NextResponse.json({ ok: true, widget: created });
}

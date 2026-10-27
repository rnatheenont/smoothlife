import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { WIDGET_DEFAULTS, type WidgetRow } from "@/lib/widget-defaults";

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const rows = await supabaseRest<WidgetRow[]>("free_gift_widgets?select=key,label_th,enabled,config&order=key.asc");

  // The same gap-filling the storefront route does, for the same reason and
  // with the same list. This one was missed when that was fixed, which is
  // the whole argument for one list: a widget added in code showed up for
  // shoppers and stayed invisible to the admin who has to switch it on.
  const stored = new Map(rows.map((r) => [r.key, r]));
  const widgets = [...rows];
  for (const fallback of WIDGET_DEFAULTS) {
    if (!stored.has(fallback.key)) widgets.push(fallback);
  }
  widgets.sort((a, b) => a.key.localeCompare(b.key));
  return NextResponse.json({ ok: true, widgets });
}

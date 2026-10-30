import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { isMascotThemeSetting, seasonalTheme, SEASONS } from "@/components/mascot/mascot-theme";
import { MASCOT_THEME_TAG } from "@/lib/mascot-theme-server";

// Smoothie's outfit on the storefront: "auto" (the seasonal calendar), or one
// outfit forced. Saving clears the layout's cached read, so the next page load
// anywhere on the site wears the new outfit.

type Row = { theme: string; updated_at: string; updated_by: string | null };

async function current() {
  const rows = await supabaseRest<Row[]>("mascot_settings?select=theme,updated_at,updated_by&id=eq.true");
  const row = rows[0];
  return {
    setting: isMascotThemeSetting(row?.theme) ? row.theme : "auto",
    updatedAt: row?.updated_at ?? null,
    // What "auto" means today, so the screen can say it.
    seasonal: seasonalTheme(),
    seasons: SEASONS,
  };
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  return NextResponse.json({ ok: true, ...(await current()) });
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  if (!isMascotThemeSetting(body.setting)) {
    return NextResponse.json({ ok: false, error: "ไม่รู้จักชุดนี้" }, { status: 400 });
  }
  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  await supabaseRest("mascot_settings?on_conflict=id", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id: true,
      theme: body.setting,
      updated_at: new Date().toISOString(),
      updated_by: session?.userId ?? null,
    }),
  });
  revalidateTag(MASCOT_THEME_TAG, { expire: 0 });
  return NextResponse.json({ ok: true, ...(await current()) });
}

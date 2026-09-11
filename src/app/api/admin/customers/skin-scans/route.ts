import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";

// A member's saved Skin Coach scans, for support: what their skin looked like
// to the scan and when, so a product question can be answered with it in
// view. Numbers only — no photo is ever stored to show.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const userId = req.nextUrl.searchParams.get("userId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ ok: false, error: "รหัสบัญชีไม่ถูกต้อง" }, { status: 400 });
  }
  const scans = await supabaseRest(
    `skin_scans?user_id=eq.${userId}&order=scanned_at.desc&limit=12` +
      `&select=id,scanned_at,angles,confidence,skin_age,age_range,skin_type,main_concern,metrics`
  );
  return NextResponse.json({ ok: true, scans });
}

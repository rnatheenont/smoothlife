import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const userId = body?.userId;
  const delta = body?.delta;
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : null;

  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ ok: false, error: "ไม่พบลูกค้าที่จะปรับแต้ม" }, { status: 400 });
  }
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ ok: false, error: "กรุณาระบุจำนวนแต้มที่จะปรับ (ไม่เป็นศูนย์)" }, { status: 400 });
  }

  await supabaseRest("points_ledger", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: userId,
      delta,
      reason: "manual_adjust",
      metadata: { note, admin: true },
    }),
  });

  const [balanceRow] = await supabaseRest<{ user_id: string; balance: number }[]>(
    `points_balance?user_id=eq.${userId}&select=user_id,balance`
  );
  return NextResponse.json({ ok: true, balance: balanceRow?.balance ?? 0 });
}

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import type { SubscriptionRow } from "../route";

// Toggles whether we keep reminding the customer near this subscription's
// renewal date — there's no real recurring charge to cancel, so
// "unsubscribe" here means "stop nudging me", which is genuinely real and
// immediate. Re-enabling ("subscribe" again) resumes reminders for future
// renewal dates.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.active !== "boolean") {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const [row] = await supabaseRest<SubscriptionRow[]>(
    `subscription_preferences?id=eq.${params.id}&user_id=eq.${uid}`,
    { method: "PATCH", body: JSON.stringify({ active: body.active, updated_at: new Date().toISOString() }) }
  );
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบรายการสมัครนี้" }, { status: 404 });
  return NextResponse.json({ ok: true, subscription: row });
}

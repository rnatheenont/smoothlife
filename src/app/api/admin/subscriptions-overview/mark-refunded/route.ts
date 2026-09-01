import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

// Records that a charge was refunded — bookkeeping only. There's no 2C2P
// refund API wired in yet, so the actual refund still happens manually in
// 2C2P's own merchant portal; this just keeps an audit trail in our own
// system so "was this refunded" isn't tribal knowledge.
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const chargeId = body?.chargeId;
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : "";
  if (typeof chargeId !== "string" || !chargeId) {
    return NextResponse.json({ ok: false, error: "ไม่พบรายการตัดเงินนี้" }, { status: 400 });
  }

  await supabaseRest(`real_subscription_charges?id=eq.${chargeId}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ refunded_at: new Date().toISOString(), refund_note: note || null }),
  });

  return NextResponse.json({ ok: true });
}

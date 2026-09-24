import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { leaveFlashSale, UUID_RE } from "@/lib/flash-sale";

// Step out of line — whether the turn has come or not.
//
// fs_leave knows about the line. A slot already held is a different thing: it
// has stock counted against it, and giving it back means decrementing a
// counter and handing it to the next person, which is exactly the arithmetic
// the reservation clock already does correctly once a minute. So rather than
// repeat that here and risk overselling, the hold is simply made due now and
// the existing sweep collects it — the page polls every three seconds, so the
// next person sees it almost at once.
//
// payment_pending_until goes with it. That column exists to stop the clock
// pulling a slot out from under someone in the middle of paying, which is the
// right instinct and the wrong one here: the person has just said they are not
// paying. Leaving it set means the button reports success and the screen does
// not change until the grace period runs out. A charge that still arrives
// afterwards is the case the late-payment refund path already exists for.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  try {
    const result = await leaveFlashSale(id, userId);
    if (result.ok) return NextResponse.json({ ok: true });

    const now = new Date().toISOString();
    const released = await supabaseRest<{ id: string }[]>(
      `flash_sale_queue?campaign_id=eq.${pgValue(id)}&user_id=eq.${pgValue(userId)}&status=eq.reserved&select=id`,
      { method: "PATCH", body: JSON.stringify({ expires_at: now, payment_pending_until: now }) }
    );
    if (released.length) return NextResponse.json({ ok: true, released: true });

    return NextResponse.json({ ok: false, error: "ไม่มีคิวที่รออยู่" }, { status: 409 });
  } catch (err) {
    console.error("[flash-sale] leave failed", err);
    return NextResponse.json({ ok: false, error: "ออกจากคิวไม่สำเร็จ" }, { status: 500 });
  }
}

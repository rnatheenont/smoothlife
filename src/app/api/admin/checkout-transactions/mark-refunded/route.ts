import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";

// Bookkeeping-only fallback for when the real 2C2P refund call
// (checkout-transactions/refund) isn't usable yet (RSA key exchange not
// done) or the admin already refunded the customer manually via 2C2P's
// merchant portal — same pattern as the subscription charges' own
// mark-refunded route, just for the general-purchase table.
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const transactionId = body?.transactionId;
  if (!transactionId) return NextResponse.json({ ok: false, error: "missing transactionId" }, { status: 400 });

  await supabaseRest(`payment_transactions?id=eq.${transactionId}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_note: `บันทึกด้วยตนเอง${body?.note ? `: ${body.note}` : ""}`,
    }),
  });

  return NextResponse.json({ ok: true });
}

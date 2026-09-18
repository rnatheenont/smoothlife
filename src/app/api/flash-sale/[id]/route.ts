import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { flashSaleStatus, UUID_RE } from "@/lib/flash-sale";
import { linePushConfigured } from "@/lib/line-push";

// The sale page polls this: campaign phase, each product's stock and, for a
// signed-in shopper, their own place in line. Reading it also settles overdue
// reservations (lazy expiry), so the numbers are current.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  try {
    const status = await flashSaleStatus(id, userId);
    if (!status) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
    // A charge that came in after the shopper's slot was gone: say so plainly
    // rather than leave them wondering where the money went.
    let refundPending = false;
    if (userId) {
      const flagged = await supabaseRest<{ id: string }[]>(
        `payment_transactions?user_id=eq.${pgValue(userId)}&refund_note=like.FLASH_SALE_*&status=eq.success&select=id,flash_sale_queue!inner(campaign_id)&flash_sale_queue.campaign_id=eq.${pgValue(id)}&limit=1`
      ).catch(() => []);
      refundPending = flagged.length > 0;
    }
    // Whether we can reach this shopper when their turn comes — the page says
    // so while they wait, and offers to link LINE when we cannot.
    let lineLinked = false;
    if (userId && linePushConfigured()) {
      const [identity] = await supabaseRest<{ provider_uid: string }[]>(
        `auth_identities?user_id=eq.${pgValue(userId)}&provider=eq.line&select=provider_uid&limit=1`
      ).catch((): { provider_uid: string }[] => []);
      lineLinked = Boolean(identity);
    }

    return NextResponse.json(
      { ok: true, signedIn: Boolean(userId), refundPending, lineNotify: linePushConfigured(), lineLinked, ...status },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[flash-sale] status failed", err);
    return NextResponse.json({ ok: false, error: "โหลดข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

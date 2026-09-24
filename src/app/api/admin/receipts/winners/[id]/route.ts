import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// Confirming a prize on someone's behalf, or marking it given up.
//
// Marking one forfeited is what calls the next reserve up, and it does so
// without touching anybody's rank: the prize belongs to the first twenty-five
// places that were not given up (holdsPrize), so the drawn order stays exactly
// as it was drawn. That matters more than the convenience of renumbering — the
// order is the evidence.
//
// It is a person's decision, never a timer's. A deadline that passes quietly at
// midnight and takes a prize with it is not a decision anybody made.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "dentiste-x-kengnamping";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "confirm" && action !== "forfeit" && action !== "reset") {
    return NextResponse.json({ ok: false, error: "action ต้องเป็น confirm, forfeit หรือ reset" }, { status: 400 });
  }

  const [winner] = await supabaseRest<{ id: string; prize_type: string; rank: number; status: string }[]>(
    `receipt_campaign_winners?id=eq.${pgValue(id)}&campaign_key=eq.${CAMPAIGN}&select=id,prize_type,rank,status&limit=1`
  );
  if (!winner) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });

  const status = action === "confirm" ? "confirmed" : action === "forfeit" ? "forfeited" : "pending_confirm";
  await supabaseRest(`receipt_campaign_winners?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status,
      confirmed_at: action === "confirm" ? new Date().toISOString() : null,
    }),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: `receipt.winner.${action}`,
      target: id,
      detail: { campaign: CAMPAIGN, prizeType: winner.prize_type, rank: winner.rank, from: winner.status, to: status },
    }),
  }).catch((err) => console.error("[admin/receipts/winners] audit write failed", err));

  return NextResponse.json({ ok: true, status });
}

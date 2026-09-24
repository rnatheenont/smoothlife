import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { holdsPrize } from "@/lib/receipt-campaign";

// A winner accepting their own prize.
//
// Confirming is the customer's to do, so it is theirs to do here rather than
// something support types in on the phone. Giving one up is not: a tap that
// hands ฿55,000 to the next person in line should not be one tap away from
// "confirm", and anyone who means it can say so and have staff mark it.
//
// The deadline is checked but not enforced by a clock alone — see the admin
// route: a prize is lost when a person decides it is, never at midnight.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "dentiste-x-kengnamping";

type Row = {
  id: string;
  user_id: string;
  prize_type: "vip" | "lucky_fan";
  rank: number;
  status: "pending_confirm" | "confirmed" | "forfeited";
  confirm_deadline: string;
};

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "ไม่พบรางวัลนี้" }, { status: 400 });
  }

  const all = await supabaseRest<Row[]>(
    `receipt_campaign_winners?campaign_key=eq.${CAMPAIGN}` +
      `&select=id,user_id,prize_type,rank,status,confirm_deadline&order=rank`
  );
  const mine = all.find((w) => w.id === id && w.user_id === uid);
  if (!mine) return NextResponse.json({ ok: false, error: "ไม่พบรางวัลนี้" }, { status: 404 });
  if (mine.status === "confirmed") return NextResponse.json({ ok: true, already: true });
  if (mine.status === "forfeited") {
    return NextResponse.json({ ok: false, error: "สิทธิ์นี้ถูกสละไปแล้ว กรุณาติดต่อทีมงาน" }, { status: 409 });
  }

  // Holding it is what makes it theirs to accept — a reserve confirming a
  // prize nobody has given up yet would be accepting something they do not
  // have.
  const holding = holdsPrize(all.filter((w) => w.prize_type === mine.prize_type));
  if (![...holding].some((w) => w.id === mine.id)) {
    return NextResponse.json(
      { ok: false, error: "ขณะนี้คุณอยู่ในลำดับสำรอง ยังไม่ต้องยืนยันสิทธิ์" },
      { status: 409 }
    );
  }

  const deadline = Date.parse(mine.confirm_deadline);
  if (Number.isFinite(deadline) && Date.now() > deadline) {
    return NextResponse.json(
      { ok: false, error: "เลยกำหนดยืนยันสิทธิ์แล้ว กรุณาติดต่อทีมงานเพื่อตรวจสอบ" },
      { status: 409 }
    );
  }

  await supabaseRest(`receipt_campaign_winners?id=eq.${pgValue(id)}&status=eq.pending_confirm`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "confirmed", confirmed_at: new Date().toISOString() }),
  });

  return NextResponse.json({ ok: true });
}

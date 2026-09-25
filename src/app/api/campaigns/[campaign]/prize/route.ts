import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { holdsPrize } from "@/lib/receipt-campaign";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";

// Whether this customer won, and letting them say they want it.
//
// The prize is the first twenty-five places that were not given up, so someone
// drawn at 27 can be holding one by the time they look — and someone drawn at 3
// stops holding it the moment they give it up. That is computed here rather
// than stored, so a reserve who has just been promoted sees it immediately
// instead of after somebody remembers to renumber a table.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



type Place = {
  id: string;
  prize_type: "vip" | "lucky_fan";
  rank: number;
  user_id: string;
  status: "pending_confirm" | "confirmed" | "forfeited";
  confirm_deadline: string;
};

const PRIZE_LABEL = { vip: "รางวัล VIP", lucky_fan: "รางวัล Lucky Fan" } as const;

async function placesFor(campaignKey: string, prizeType: string) {
  return supabaseRest<Place[]>(
    `receipt_campaign_winners?campaign_key=eq.${pgValue(campaignKey)}&prize_type=eq.${prizeType}` +
      `&select=id,prize_type,rank,user_id,status,confirm_deadline&order=rank.asc&limit=200`
  ).catch(() => [] as Place[]);
}

/** Every prize this customer is currently holding, with what they can do about it. */
async function myPrizes(campaignKey: string, uid: string) {
  const [vip, fan] = await Promise.all([placesFor(campaignKey, "vip"), placesFor(campaignKey, "lucky_fan")]);
  const out = [];
  for (const places of [vip, fan]) {
    const holders = holdsPrize(places);
    for (const p of places) {
      if (p.user_id !== uid) continue;
      out.push({
        id: p.id,
        prizeType: p.prize_type,
        label: PRIZE_LABEL[p.prize_type],
        rank: p.rank,
        status: p.status,
        /** Holding it now — a reserve promoted by someone else's forfeit is too. */
        holding: holders.has(p),
        confirmDeadline: p.confirm_deadline,
        expired: Date.now() > Date.parse(p.confirm_deadline),
      });
    }
  }
  return out;
}

export async function GET(req: NextRequest, props: { params: Promise<{ campaign: string }> }) {
  const CAMPAIGN = campaignKeyFrom((await props.params).campaign);
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, prizes: [] }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, prizes: [] });
  return NextResponse.json({ ok: true, prizes: await myPrizes(CAMPAIGN, uid) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, props: { params: Promise<{ campaign: string }> }) {
  const CAMPAIGN = campaignKeyFrom((await props.params).campaign);
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "ไม่พบรางวัลนี้" }, { status: 400 });
  }

  // Their own, still theirs to claim, and still in time — all three checked
  // here, because the button being on screen is not one of them.
  const mine = (await myPrizes(CAMPAIGN, uid)).find((p) => p.id === id);
  if (!mine) return NextResponse.json({ ok: false, error: "ไม่พบรางวัลนี้" }, { status: 404 });
  if (mine.status === "forfeited") {
    return NextResponse.json({ ok: false, error: "รางวัลนี้ถูกสละสิทธิ์ไปแล้ว" }, { status: 409 });
  }
  if (!mine.holding) {
    return NextResponse.json({ ok: false, error: "คุณอยู่ในรายชื่อสำรอง ยังไม่ต้องยืนยันสิทธิ์ตอนนี้" }, { status: 409 });
  }
  if (mine.expired) {
    return NextResponse.json({ ok: false, error: "หมดเวลายืนยันสิทธิ์แล้ว กรุณาติดต่อทีมงาน" }, { status: 409 });
  }
  if (mine.status === "confirmed") return NextResponse.json({ ok: true, status: "confirmed" });

  await supabaseRest(`receipt_campaign_winners?id=eq.${pgValue(id)}&status=eq.pending_confirm`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "confirmed", confirmed_at: new Date().toISOString() }),
  });
  return NextResponse.json({ ok: true, status: "confirmed" });
}

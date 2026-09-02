import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";

type SubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  auto_renew_cancelled: boolean;
};

// Stops a REAL recurring plan from renewing into another term. A term is a
// commitment: cancelling never ends one early and never stops a charge that
// is already part of the current term — it only means "don't start the next
// term". That is a decision entirely on our side, so this makes no 2C2P call
// at all.
//
// The 2C2P plan created at subscribe time is bounded to exactly this term's
// cycles (recurringCount = plan.months in ../../checkout/route.ts), so it
// expires on 2C2P's side by itself at the term boundary — there is nothing
// to cancel there, which is what keeps this flow clear of the Recurring
// Payment Maintenance API (HTTP 401 on this merchant account).
//
// Renewal is the mirror image: something has to *start* the next term's plan
// for subscriptions that reach the boundary without this flag set.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }

  const [subscription] = await supabaseRest<SubscriptionRow[]>(
    `real_subscriptions?id=eq.${params.id}&user_id=eq.${uid}&select=id,user_id,status,auto_renew_cancelled`
  );
  if (!subscription) return NextResponse.json({ ok: false, error: "ไม่พบรายการสมัครนี้" }, { status: 404 });
  if (subscription.status !== "active" && subscription.status !== "past_due") {
    return NextResponse.json({ ok: false, error: "การสมัครนี้ไม่ได้อยู่ในสถานะที่ยกเลิกได้" }, { status: 400 });
  }
  if (subscription.auto_renew_cancelled) {
    return NextResponse.json({ ok: false, error: "ยกเลิกการต่ออายุไปแล้ว" }, { status: 400 });
  }

  // Stays `active` with its next_charge_date intact: the remaining cycles of
  // the current term are still owed and still ship. Only the renewal is off.
  await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      auto_renew_cancelled: true,
      updated_at: new Date().toISOString(),
    }),
  });

  return NextResponse.json({ ok: true });
}

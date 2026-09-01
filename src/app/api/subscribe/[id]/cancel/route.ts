import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { cancelRecurringPlan, recurringMaintenanceConfigured } from "@/lib/2c2p";

type SubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  auto_renew_cancelled: boolean;
  recurring_unique_id: string | null;
  amount_per_cycle: number;
};

// Cancels a REAL recurring plan — unlike the interim subscription_preferences
// system's toggle, this must succeed against 2C2P before we ever mark the
// row cancelled, or the customer keeps getting charged while believing
// they cancelled.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }
  if (!recurringMaintenanceConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ระบบยกเลิกอัตโนมัติยังไม่พร้อมใช้งาน กรุณาติดต่อทีมงานเพื่อยกเลิกด้วยตนเอง" },
      { status: 503 }
    );
  }

  const [subscription] = await supabaseRest<SubscriptionRow[]>(
    `real_subscriptions?id=eq.${params.id}&user_id=eq.${uid}&select=id,user_id,status,auto_renew_cancelled,recurring_unique_id,amount_per_cycle`
  );
  if (!subscription) return NextResponse.json({ ok: false, error: "ไม่พบรายการสมัครนี้" }, { status: 404 });
  if (subscription.status !== "active" && subscription.status !== "past_due") {
    return NextResponse.json({ ok: false, error: "การสมัครนี้ไม่ได้อยู่ในสถานะที่ยกเลิกได้" }, { status: 400 });
  }
  if (subscription.auto_renew_cancelled) {
    return NextResponse.json({ ok: false, error: "ยกเลิกการต่ออายุไปแล้ว" }, { status: 400 });
  }
  if (!subscription.recurring_unique_id) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่มีข้อมูลแผนการตัดเงินจาก 2C2P สำหรับรายการนี้ กรุณาติดต่อทีมงาน" },
      { status: 409 }
    );
  }

  let result;
  try {
    result = await cancelRecurringPlan(subscription.recurring_unique_id, subscription.amount_per_cycle);
  } catch (err) {
    console.error("[subscribe/cancel] 2C2P call failed", err);
    return NextResponse.json({ ok: false, error: "เชื่อมต่อกับระบบตัดเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }

  if (result.respCode !== "00") {
    console.error("[subscribe/cancel] 2C2P declined cancellation", result);
    return NextResponse.json({ ok: false, error: `ยกเลิกไม่สำเร็จ: ${result.respReason || result.respCode}` }, { status: 502 });
  }

  // Policy: nothing is ever prepaid ahead of what's already been charged
  // and shipped, so once 2C2P confirms the recurring plan is cancelled
  // there's nothing further owed — end the subscription immediately rather
  // than deferring to a later cron step.
  await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "ended",
      auto_renew_cancelled: true,
      next_charge_date: null,
      updated_at: new Date().toISOString(),
    }),
  });

  return NextResponse.json({ ok: true });
}

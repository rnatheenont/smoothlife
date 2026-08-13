import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { addDays, businessDateNow, CYCLE_LENGTH_DAYS, daysBetween, RECOVERY_COST_PER_DAY, RECOVERY_MAX_DAYS_BACK } from "@/lib/checkin";
import { getLatestCycle, getPointBalance, syncCycleStatus, awardMilestones } from "@/lib/checkin-server";

// Spends points to fill a missed check-in day. Client sends the date it
// wants recovered, but every rule (window, cycle bounds, already-checked,
// balance) is re-verified server-side — the client's date is only a hint.
export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const date = typeof body?.date === "string" ? body.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "วันที่ไม่ถูกต้องค่ะ" }, { status: 400 });
  }

  const today = businessDateNow();
  const age = daysBetween(date, today);
  if (age <= 0 || age > RECOVERY_MAX_DAYS_BACK) {
    return NextResponse.json(
      { ok: false, error: "วันที่เลือกไม่สามารถกู้คืนได้ค่ะ", code: "DATE_NOT_RECOVERABLE" },
      { status: 400 }
    );
  }

  const cycle = await getLatestCycle(uid);
  if (!cycle || (cycle.status !== "active" && cycle.status !== "recovery_available")) {
    return NextResponse.json(
      { ok: false, error: "ไม่พบรอบเช็กอินที่กู้ได้ในตอนนี้ค่ะ", code: "DATE_OUTSIDE_CURRENT_CYCLE" },
      { status: 400 }
    );
  }
  const cycleEnd = addDays(cycle.start_date, CYCLE_LENGTH_DAYS - 1);
  if (daysBetween(cycle.start_date, date) < 0 || daysBetween(date, cycleEnd) < 0) {
    return NextResponse.json(
      { ok: false, error: "วันที่เลือกอยู่นอกรอบเช็กอินปัจจุบันค่ะ", code: "DATE_OUTSIDE_CURRENT_CYCLE" },
      { status: 400 }
    );
  }

  const alreadyChecked = await supabaseRest<{ id: string }[]>(
    `daily_checkins?user_id=eq.${uid}&checkin_date=eq.${date}&select=id`
  );
  if (alreadyChecked.length > 0) {
    return NextResponse.json(
      { ok: false, error: "วันที่นี้เช็กอินไปแล้วค่ะ", code: "DATE_ALREADY_CHECKED_IN" },
      { status: 409 }
    );
  }

  const balance = await getPointBalance(uid);
  if (balance < RECOVERY_COST_PER_DAY) {
    return NextResponse.json(
      { ok: false, error: "แต้มของคุณไม่พอสำหรับกู้วันนี้ค่ะ", code: "INSUFFICIENT_POINTS" },
      { status: 400 }
    );
  }

  let insertedCheckinId: string | null = null;
  try {
    const [inserted] = await supabaseRest<{ id: string }[]>("daily_checkins", {
      method: "POST",
      body: JSON.stringify({
        user_id: uid,
        cycle_id: cycle.id,
        checkin_date: date,
        source: "recovery",
        points_spent: RECOVERY_COST_PER_DAY,
      }),
    });
    insertedCheckinId = inserted?.id ?? null;

    await supabaseRest("points_ledger", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: uid,
        delta: -RECOVERY_COST_PER_DAY,
        reason: "checkin_recovery",
        metadata: { cycle_id: cycle.id, recovered_date: date },
      }),
    });
  } catch (err) {
    console.error("[checkin recover] failed", err);
    if (insertedCheckinId) {
      await supabaseRest(`daily_checkins?id=eq.${insertedCheckinId}`, { method: "DELETE", returning: false }).catch(
        () => {}
      );
    }
    return NextResponse.json({ ok: false, error: "กู้วันเช็กอินไม่สำเร็จค่ะ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }

  const synced = await syncCycleStatus(cycle, today);
  const { cycle: finalCycle, result } = await awardMilestones(synced.cycle);
  const newBalance = await getPointBalance(uid);

  return NextResponse.json({
    ok: true,
    recoveredDate: date,
    pointsSpent: RECOVERY_COST_PER_DAY,
    pointBalance: newBalance,
    completedDays: finalCycle.completed_days,
    status: finalCycle.status,
    day3Awarded: result.day3Awarded,
    day7Awarded: result.day7Awarded,
    day7Coupon: result.day7Coupon,
  });
}

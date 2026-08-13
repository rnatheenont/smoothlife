import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { addDays, businessDateNow, CYCLE_LENGTH_DAYS, DAY3_REWARD_POINTS, DAY7_REWARD_POINTS, daysBetween, RECOVERY_COST_PER_DAY, CycleRow } from "@/lib/checkin";
import { getLatestCycle, getPointBalance, syncCycleStatus, awardMilestones } from "@/lib/checkin-server";

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ loggedIn: false });
  }

  const today = businessDateNow();
  const [cycle, pointBalance] = await Promise.all([getLatestCycle(uid), getPointBalance(uid)]);
  const config = { cycleLength: CYCLE_LENGTH_DAYS, day3Points: DAY3_REWARD_POINTS, day7Points: DAY7_REWARD_POINTS };

  if (!cycle) {
    return NextResponse.json({
      loggedIn: true,
      businessDate: today,
      checkedInToday: false,
      cycle: null,
      previousCycle: null,
      recovery: { costPerDay: RECOVERY_COST_PER_DAY, pointBalance, recoverableDates: [] },
      config,
    });
  }

  // Recompute the real status first — the DB row can be stale since nothing
  // flips it on a schedule — then branch on the freshly-derived status, not
  // whatever was last persisted.
  const { cycle: synced, checkins, recoverableDates } = await syncCycleStatus(cycle, today);
  const checkedInToday = checkins.some((c) => c.checkin_date === today);

  if (synced.status === "completed" || synced.status === "failed") {
    return NextResponse.json({
      loggedIn: true,
      businessDate: today,
      checkedInToday,
      cycle: null,
      previousCycle: { status: synced.status, completedDays: synced.completed_days },
      recovery: { costPerDay: RECOVERY_COST_PER_DAY, pointBalance, recoverableDates: [] },
      config,
    });
  }
  const dates = Array.from({ length: CYCLE_LENGTH_DAYS }).map((_, i) => {
    const date = addDays(synced.start_date, i);
    const row = checkins.find((c) => c.checkin_date === date);
    const status = row
      ? row.source
      : recoverableDates.includes(date)
      ? "recoverable"
      : date < today
      ? "missed"
      : date === today
      ? "today"
      : "upcoming";
    return { date, dayNumber: i + 1, status };
  });

  return NextResponse.json({
    loggedIn: true,
    businessDate: today,
    checkedInToday,
    cycle: {
      id: synced.id,
      status: synced.status,
      completedDays: synced.completed_days,
      targetDays: CYCLE_LENGTH_DAYS,
      dates,
      day3RewardClaimed: synced.day3_reward_claimed,
      day7RewardClaimed: synced.day7_reward_claimed,
      day7CouponCode: synced.day7_coupon_code,
    },
    recovery: { costPerDay: RECOVERY_COST_PER_DAY, pointBalance, recoverableDates },
    config,
  });
}

// Normal check-in for today. Never trusts a date from the client — the
// business date is always computed server-side.
export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนเช็กอินค่ะ" }, { status: 401 });
  }

  const today = businessDateNow();

  const existing = await supabaseRest<{ id: string }[]>(
    `daily_checkins?user_id=eq.${uid}&checkin_date=eq.${today}&select=id`
  );
  if (existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "วันนี้คุณเช็กอินเรียบร้อยแล้วค่ะ", code: "ALREADY_CHECKED_IN" },
      { status: 409 }
    );
  }

  let cycle = await getLatestCycle(uid);
  const needsNewCycle =
    !cycle ||
    cycle.status === "completed" ||
    cycle.status === "failed" ||
    daysBetween(cycle.start_date, today) >= CYCLE_LENGTH_DAYS;

  if (needsNewCycle) {
    const [created] = await supabaseRest<CycleRow[]>("checkin_cycles", {
      method: "POST",
      body: JSON.stringify({ user_id: uid, start_date: today }),
    });
    cycle = created;
  }
  if (!cycle) {
    return NextResponse.json({ ok: false, error: "สร้างรอบเช็กอินไม่สำเร็จค่ะ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }

  try {
    await supabaseRest("daily_checkins", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: uid,
        cycle_id: cycle.id,
        checkin_date: today,
        source: "normal",
        points_spent: 0,
      }),
    });
  } catch (err) {
    console.error("[checkin] insert failed", err);
    return NextResponse.json(
      { ok: false, error: "วันนี้คุณเช็กอินเรียบร้อยแล้วค่ะ", code: "ALREADY_CHECKED_IN" },
      { status: 409 }
    );
  }

  const synced = await syncCycleStatus(cycle, today);
  const { cycle: finalCycle, result } = await awardMilestones(synced.cycle);

  return NextResponse.json({
    ok: true,
    completedDays: finalCycle.completed_days,
    status: finalCycle.status,
    day3Awarded: result.day3Awarded,
    day7Awarded: result.day7Awarded,
    day7Coupon: result.day7Coupon,
  });
}

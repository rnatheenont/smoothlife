import { supabaseRest } from "@/lib/supabase-server";
import { createPercentDiscountCode, shopifyAdminConfigured } from "@/lib/shopify-admin";
import {
  ACTIVE_CHALLENGE,
  CheckinDate,
  CheckinRow,
  CycleRow,
  DAY3_REWARD_POINTS,
  DAY7_COUPON_PERCENTAGE,
  DAY7_REWARD_POINTS,
  daysInMonth,
  deriveCycleState,
  isChallengeActive,
  MONTHLY_ATTENDANCE_REWARD_POINTS,
  yearMonthOf,
} from "@/lib/checkin";

export async function getLatestCycle(uid: string): Promise<CycleRow | null> {
  const [row] = await supabaseRest<CycleRow[]>(
    `checkin_cycles?user_id=eq.${uid}&order=start_date.desc&limit=1`
  );
  return row || null;
}

export async function getCycleCheckins(uid: string, cycleId: string): Promise<CheckinRow[]> {
  return supabaseRest<CheckinRow[]>(
    `daily_checkins?user_id=eq.${uid}&cycle_id=eq.${cycleId}&select=checkin_date,source&order=checkin_date.asc`
  );
}

// Recomputes and persists the cycle's status/completed_days from real
// check-in rows — there's no scheduled job to do this on a timer, so every
// read or write call re-derives it fresh instead of trusting a stale column.
export async function syncCycleStatus(cycle: CycleRow, today: CheckinDate): Promise<{ cycle: CycleRow; checkins: CheckinRow[]; recoverableDates: CheckinDate[] }> {
  const checkins = await getCycleCheckins(cycle.user_id, cycle.id);
  const derived = deriveCycleState(cycle.start_date, checkins, today);
  if (derived.status !== cycle.status || derived.completedDays !== cycle.completed_days) {
    const [updated] = await supabaseRest<CycleRow[]>(`checkin_cycles?id=eq.${cycle.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: derived.status,
        completed_days: derived.completedDays,
        updated_at: new Date().toISOString(),
      }),
    });
    cycle = updated || { ...cycle, status: derived.status, completed_days: derived.completedDays };
  }
  return { cycle, checkins, recoverableDates: derived.recoverableDates };
}

async function creditPoints(
  uid: string,
  amount: number,
  reason: "checkin_reward" | "checkin_recovery" | "challenge_bonus" | "monthly_attendance_reward",
  metadata: Record<string, unknown>
) {
  await supabaseRest("points_ledger", {
    method: "POST",
    returning: false,
    body: JSON.stringify({ user_id: uid, delta: amount, reason, metadata }),
  });
}

// If the 7-Day Challenge campaign is running today, credit the extra points
// as a *separate* ledger entry rather than inflating the base checkin_reward
// amount — keeps the base reward auditable/unchanged and the bonus clearly
// attributable to the campaign.
async function creditChallengeBonus(uid: string, baseAmount: number, cycleId: string, milestone: 3 | 7, today: CheckinDate) {
  if (!isChallengeActive(today)) return 0;
  const bonus = baseAmount * (ACTIVE_CHALLENGE.multiplier - 1);
  if (bonus <= 0) return 0;
  await creditPoints(uid, bonus, "challenge_bonus", { cycle_id: cycleId, milestone, challenge_id: ACTIVE_CHALLENGE.id });
  return bonus;
}

export type MilestoneResult = {
  day3Awarded: boolean;
  day7Awarded: boolean;
  day7Coupon: string | null;
  challengeBonus: number;
};

// Checks whether this cycle just crossed day 3 or day 7 and, if so, credits
// the real points_ledger and (for day 7) issues a real single-use Shopify
// discount code — the actual sales lever, not a fake "you won!" screen.
export async function awardMilestones(cycle: CycleRow, today: CheckinDate): Promise<{ cycle: CycleRow; result: MilestoneResult }> {
  const result: MilestoneResult = { day3Awarded: false, day7Awarded: false, day7Coupon: null, challengeBonus: 0 };
  const patch: Record<string, unknown> = {};

  if (cycle.completed_days >= 3 && !cycle.day3_reward_claimed) {
    await creditPoints(cycle.user_id, DAY3_REWARD_POINTS, "checkin_reward", { cycle_id: cycle.id, milestone: 3 });
    result.challengeBonus += await creditChallengeBonus(cycle.user_id, DAY3_REWARD_POINTS, cycle.id, 3, today);
    patch.day3_reward_claimed = true;
    result.day3Awarded = true;
  }

  if (cycle.completed_days >= 7 && !cycle.day7_reward_claimed) {
    await creditPoints(cycle.user_id, DAY7_REWARD_POINTS, "checkin_reward", { cycle_id: cycle.id, milestone: 7 });
    result.challengeBonus += await creditChallengeBonus(cycle.user_id, DAY7_REWARD_POINTS, cycle.id, 7, today);
    patch.day7_reward_claimed = true;
    result.day7Awarded = true;

    if (shopifyAdminConfigured()) {
      try {
        const code = `CHECKIN7-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await createPercentDiscountCode({
          title: `Daily check-in day-7 reward (${cycle.user_id.slice(0, 8)})`,
          code,
          percentage: DAY7_COUPON_PERCENTAGE,
          usageLimit: 1,
        });
        patch.day7_coupon_code = code;
        result.day7Coupon = code;
      } catch (err) {
        console.error("[checkin] day-7 coupon creation failed", err);
      }
    }
  }

  if (Object.keys(patch).length > 0) {
    const [updated] = await supabaseRest<CycleRow[]>(`checkin_cycles?id=eq.${cycle.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    cycle = updated || { ...cycle, ...patch };
  }

  return { cycle, result };
}

export async function getPointBalance(uid: string): Promise<number> {
  const [row] = await supabaseRest<{ balance: number }[]>(`points_balance?user_id=eq.${uid}&select=balance`);
  return row?.balance ?? 0;
}

export type MonthlyAttendance = {
  yearMonth: string;
  completedDays: number;
  requiredDays: number;
  rewarded: boolean;
};

// Members who sign up mid-month only need to check in from their signup day
// onward, not the whole calendar month — computed live from users.created_at,
// no separate "eligible_start_date" column needed.
function requiredDaysFor(yearMonth: string, userCreatedAt: string): number {
  const total = daysInMonth(yearMonth);
  const signupYearMonth = userCreatedAt.slice(0, 7);
  if (signupYearMonth < yearMonth) return total;
  if (signupYearMonth > yearMonth) return total + 1; // not eligible yet — unreachable target
  const signupDay = Number(userCreatedAt.slice(8, 10));
  return total - signupDay + 1;
}

export async function getMonthlyAttendance(uid: string, yearMonth: string, userCreatedAt: string): Promise<MonthlyAttendance> {
  const requiredDays = requiredDaysFor(yearMonth, userCreatedAt);
  const rows = await supabaseRest<{ checkin_date: string }[]>(
    `daily_checkins?user_id=eq.${uid}&checkin_date=gte.${yearMonth}-01&checkin_date=lt.${firstDayOfNextMonth(yearMonth)}&select=checkin_date`
  );
  const completedDays = new Set(rows.map((r) => r.checkin_date)).size;

  const existing = await supabaseRest<{ id: string }[]>(
    `points_ledger?user_id=eq.${uid}&reason=eq.monthly_attendance_reward&metadata->>year_month=eq.${yearMonth}&select=id&limit=1`
  );
  return { yearMonth, completedDays, requiredDays, rewarded: existing.length > 0 };
}

function firstDayOfNextMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return next.toISOString().slice(0, 10);
}

// Awards the one-time monthly reward the moment a check-in/recovery makes
// the user hit their required day count — no scheduled job needed since
// hitting the requirement IS the last possible day it could happen on.
export async function awardMonthlyAttendanceIfEligible(uid: string, attendance: MonthlyAttendance): Promise<boolean> {
  if (attendance.rewarded || attendance.completedDays < attendance.requiredDays) return false;
  await creditPoints(uid, MONTHLY_ATTENDANCE_REWARD_POINTS, "monthly_attendance_reward", { year_month: attendance.yearMonth });
  return true;
}

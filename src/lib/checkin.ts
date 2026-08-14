// Daily check-in business rules — Phase 1 scope (see
// docs/daily-checkin-challenge-requirements.md for the full spec this is
// deliberately scaled down from). All config here is hardcoded rather than
// admin-editable, same convention as the tier thresholds in data/coupons.ts.

export const CHECKIN_TIMEZONE = "Asia/Bangkok";
export const CYCLE_LENGTH_DAYS = 7;
export const RECOVERY_MAX_DAYS_BACK = 2;
export const RECOVERY_COST_PER_DAY = 50;
export const DAY3_REWARD_POINTS = 30;
export const DAY7_REWARD_POINTS = 100;
export const DAY7_COUPON_PERCENTAGE = 0.1; // 10% off, single-use
export const MONTHLY_ATTENDANCE_REWARD_POINTS = 200;

// Hardcoded campaign config — no admin UI for this (same convention as the
// tier thresholds in data/coupons.ts). Doubles the day-3/day-7 check-in
// rewards for anyone who crosses that milestone while the campaign is live.
// Adjust these dates directly in code to run a different window.
export const ACTIVE_CHALLENGE = {
  id: "launch-week-2026-08",
  title: "7-Day Challenge: Double Points Week",
  startDate: "2026-08-14",
  endDate: "2026-08-27",
  multiplier: 2,
};

export function isChallengeActive(date: CheckinDate): boolean {
  return date >= ACTIVE_CHALLENGE.startDate && date <= ACTIVE_CHALLENGE.endDate;
}

export type CheckinDate = string; // "YYYY-MM-DD" in CHECKIN_TIMEZONE

// Today's date string in the business timezone — the only source of truth
// for "what day is it" anywhere in the check-in system. Never accept a date
// from the client for this.
export function businessDateNow(): CheckinDate {
  return new Date().toLocaleDateString("sv-SE", { timeZone: CHECKIN_TIMEZONE });
}

export function addDays(date: CheckinDate, days: number): CheckinDate {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: CheckinDate, b: CheckinDate): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 86_400_000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

export function yearMonthOf(date: CheckinDate): string {
  return date.slice(0, 7); // "YYYY-MM"
}

export function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export type CycleRow = {
  id: string;
  user_id: string;
  start_date: string;
  completed_days: number;
  status: "active" | "recovery_available" | "completed" | "failed";
  day3_reward_claimed: boolean;
  day7_reward_claimed: boolean;
  day7_coupon_code: string | null;
};

export type CheckinRow = { checkin_date: string; source: "normal" | "recovery" };

// Derives the true cycle status + completed_days from real check-in rows and
// today's date, rather than trusting whatever was last persisted — there's
// no background job in this app to flip statuses on a schedule, so every
// read/write call recomputes and re-persists this instead.
export function deriveCycleState(
  startDate: CheckinDate,
  checkins: CheckinRow[],
  today: CheckinDate
): { status: CycleRow["status"]; completedDays: number; recoverableDates: CheckinDate[] } {
  const endDate = addDays(startDate, CYCLE_LENGTH_DAYS - 1);
  const checkedDates = new Set(checkins.map((c) => c.checkin_date));
  const completedDays = checkedDates.size;

  if (completedDays >= CYCLE_LENGTH_DAYS) {
    return { status: "completed", completedDays, recoverableDates: [] };
  }

  const recoverableDates: CheckinDate[] = [];
  let hasUnrecoverableGap = false;
  for (let d = startDate; daysBetween(d, endDate) >= 0 && daysBetween(d, today) > 0; d = addDays(d, 1)) {
    if (checkedDates.has(d)) continue;
    const age = daysBetween(d, today);
    if (age <= RECOVERY_MAX_DAYS_BACK) recoverableDates.push(d);
    else hasUnrecoverableGap = true;
  }

  if (hasUnrecoverableGap) {
    return { status: "failed", completedDays, recoverableDates: [] };
  }
  if (daysBetween(today, endDate) < 0) {
    // Cycle window fully elapsed without completing 7 days.
    return { status: "failed", completedDays, recoverableDates: [] };
  }
  if (recoverableDates.length > 0) {
    return { status: "recovery_available", completedDays, recoverableDates };
  }
  return { status: "active", completedDays, recoverableDates: [] };
}

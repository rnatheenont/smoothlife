import { supabaseRest } from "@/lib/supabase-server";
import { createPercentDiscountCode, shopifyAdminConfigured } from "@/lib/shopify-admin";
import {
  CheckinDate,
  CheckinRow,
  CycleRow,
  DAY3_REWARD_POINTS,
  DAY7_COUPON_PERCENTAGE,
  DAY7_REWARD_POINTS,
  deriveCycleState,
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

async function creditPoints(uid: string, amount: number, reason: "checkin_reward" | "checkin_recovery", metadata: Record<string, unknown>) {
  await supabaseRest("points_ledger", {
    method: "POST",
    returning: false,
    body: JSON.stringify({ user_id: uid, delta: amount, reason, metadata }),
  });
}

export type MilestoneResult = { day3Awarded: boolean; day7Awarded: boolean; day7Coupon: string | null };

// Checks whether this cycle just crossed day 3 or day 7 and, if so, credits
// the real points_ledger and (for day 7) issues a real single-use Shopify
// discount code — the actual sales lever, not a fake "you won!" screen.
export async function awardMilestones(cycle: CycleRow): Promise<{ cycle: CycleRow; result: MilestoneResult }> {
  const result: MilestoneResult = { day3Awarded: false, day7Awarded: false, day7Coupon: null };
  const patch: Record<string, unknown> = {};

  if (cycle.completed_days >= 3 && !cycle.day3_reward_claimed) {
    await creditPoints(cycle.user_id, DAY3_REWARD_POINTS, "checkin_reward", { cycle_id: cycle.id, milestone: 3 });
    patch.day3_reward_claimed = true;
    result.day3Awarded = true;
  }

  if (cycle.completed_days >= 7 && !cycle.day7_reward_claimed) {
    await creditPoints(cycle.user_id, DAY7_REWARD_POINTS, "checkin_reward", { cycle_id: cycle.id, milestone: 7 });
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

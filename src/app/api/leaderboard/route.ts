import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { formatLeaderboardName } from "@/lib/leaderboard";

const TOP_N = 15;

// Ranked by real points_balance (the same source of truth used everywhere
// else in the app) — no separate challenge-score system. Names are shown as
// first-name + last-initial only (see formatLeaderboardName) since this is
// visible to every member, not just the account owner.
export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }

  const top = await supabaseRest<{ user_id: string; balance: number }[]>(
    `points_balance?select=user_id,balance&order=balance.desc&limit=${TOP_N}`
  );

  const userIds = top.map((r) => r.user_id);
  const users = userIds.length
    ? await supabaseRest<{ id: string; display_name: string | null }[]>(
        `users?id=in.(${userIds.join(",")})&select=id,display_name`
      )
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.display_name]));

  const entries = top.map((row, i) => ({
    rank: i + 1,
    userId: row.user_id,
    name: formatLeaderboardName(nameById.get(row.user_id)),
    points: row.balance,
    isYou: row.user_id === uid,
  }));

  const [myBalanceRow] = await supabaseRest<{ balance: number }[]>(
    `points_balance?user_id=eq.${uid}&select=balance`
  );
  const myBalance = myBalanceRow?.balance ?? 0;
  const myEntry = entries.find((e) => e.isYou);

  let you: { rank: number; points: number } | null = myEntry ? { rank: myEntry.rank, points: myEntry.points } : null;
  if (!you) {
    const ahead = await supabaseRest<{ user_id: string }[]>(
      `points_balance?balance=gt.${myBalance}&select=user_id`
    );
    you = { rank: ahead.length + 1, points: myBalance };
  }

  return NextResponse.json({ ok: true, entries, you });
}

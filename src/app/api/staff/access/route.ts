import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { currentStaffRound, eligibleAccountEmail } from "@/lib/staff-shop";

// "Should this account see the employee shop in its menu?"
//
// Its own route rather than reading /api/staff/round, because the account
// menu asks on every page and that one builds the whole price list. This
// answers with a boolean and a name, and never a price.
//
// Answers `false` rather than 401 for a signed-out visitor: the menu asks
// before it knows, and false is the true answer for nearly everyone.

export async function GET(req: NextRequest) {
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId || !supabaseConfigured()) return NextResponse.json({ ok: true, available: false });

  const round = await currentStaffRound();
  if (!round) return NextResponse.json({ ok: true, available: false });

  // Already verified in this round is enough on its own — somebody who
  // proved a mailbox by OTP keeps the menu entry even if their account's
  // own address is a personal one.
  const verified = await supabaseRest<{ user_id: string }[]>(
    `staff_verifications?round_id=eq.${pgValue(round.id)}&user_id=eq.${pgValue(userId)}&select=user_id&limit=1`,
  ).catch(() => []);

  const available = Boolean(verified?.[0]) || Boolean(await eligibleAccountEmail(userId));

  return NextResponse.json({
    ok: true,
    available,
    roundName: available ? round.name : undefined,
    ends_at: available ? round.ends_at : undefined,
  });
}

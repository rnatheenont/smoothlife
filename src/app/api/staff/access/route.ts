import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase-server";
import { currentStaffRound, staffShopVisible } from "@/lib/staff-shop";

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

  // The same question the page itself asks — see staffShopVisible.
  const available = await staffShopVisible(round.id, userId);

  return NextResponse.json({
    ok: true,
    available,
    roundName: available ? round.name : undefined,
    ends_at: available ? round.ends_at : undefined,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const LEGACY_BONUS_POINTS = 100;

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

async function alreadyClaimed(uid: string) {
  const rows = await supabaseRest<{ id: string }[]>(
    `points_ledger?user_id=eq.${uid}&reason=eq.legacy_verify_bonus&select=id&limit=1`
  );
  return rows.length > 0;
}

export async function GET(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ claimed: false });
  }
  return NextResponse.json({ claimed: await alreadyClaimed(uid) });
}

// One-time self-claim bonus for accounts that already existed before this
// perk shipped — new signups get the same 100 points automatically via the
// register/verify RPCs, this just gives existing accounts parity.
export async function POST(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }

  if (await alreadyClaimed(uid)) {
    return NextResponse.json({ ok: true, claimed: true, awarded: 0 });
  }

  await supabaseRest("points_ledger", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: uid,
      delta: LEGACY_BONUS_POINTS,
      reason: "legacy_verify_bonus",
      metadata: { note: "legacy_verify_bonus" },
    }),
  });

  return NextResponse.json({ ok: true, claimed: true, awarded: LEGACY_BONUS_POINTS });
}

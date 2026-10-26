import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from "@/lib/session";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { readMergeTicket } from "@/lib/merge-ticket";

// Fold the other account into this one, on a ticket issued minutes ago by
// the link route when the shopper proved they hold its channel.
//
// The merge keeps the *older* account, which is usually not the one the
// shopper is signed in as — they are signed in as the new empty one, that
// is how they noticed. So this ends by moving the session onto the account
// that was kept. Without that the next page load would be a logout in all
// but name: an id that no longer exists.

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const ticket = readMergeTicket(body?.ticket, uid);
  if (!ticket) {
    return NextResponse.json(
      { ok: false, error: "คำยืนยันหมดอายุแล้ว กรุณายืนยันช่องทางใหม่อีกครั้ง" },
      { status: 401 },
    );
  }

  // Which of the two is kept is the database's call, not the browser's: the
  // page is told so it can say so, but a request that named its own
  // survivor would be a request that could delete the wrong account.
  const preview = await supabaseRest<{ survivor?: string } | null>("rpc/account_merge_preview", {
    method: "POST",
    body: JSON.stringify({ p_a: ticket.session, p_b: ticket.other }),
  }).catch(() => null);

  const survivor = preview?.survivor;
  if (survivor !== ticket.session && survivor !== ticket.other) {
    return NextResponse.json({ ok: false, error: "รวมบัญชีไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
  const loser = survivor === ticket.session ? ticket.other : ticket.session;

  let result: { ok?: boolean; moved?: Record<string, number> } | null = null;
  try {
    result = await supabaseRest<{ ok?: boolean; moved?: Record<string, number> }>(
      "rpc/merge_user_accounts",
      {
        method: "POST",
        body: JSON.stringify({
          p_survivor: survivor,
          p_loser: loser,
          p_proved_via: ticket.via,
          p_proved_uid: ticket.uid,
        }),
      },
    );
  } catch (err) {
    console.error("[identities/merge] failed", err);
    return NextResponse.json({ ok: false, error: "รวมบัญชีไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
  if (!result?.ok) {
    return NextResponse.json({ ok: false, error: "รวมบัญชีไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }

  const res = NextResponse.json({
    ok: true,
    survivor,
    // True when the account they were signed in as is the one that was
    // folded away: the page says "ย้ายมาที่บัญชีเดิมของคุณแล้ว" rather than
    // leaving them to notice the name at the top changed.
    switched: survivor !== ticket.session,
    moved: result.moved ?? {},
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(survivor), sessionCookieOptions);
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { MERGE_TICKET_COOKIE, readMergeTicket } from "@/lib/merge-ticket";

// The decision left waiting by a Google or LINE redirect.
//
// Those arrive as a browser navigation, so the ticket they earn is parked
// in a cookie rather than returned to a fetch. The page asks here on load:
// is there one, and if so, whose account is on the other side of it.
//
// Read-only. The cookie is cleared by the merge itself, or by giving up on
// it, never by having looked at it.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const raw = req.cookies.get(MERGE_TICKET_COOKIE)?.value;
  const ticket = readMergeTicket(raw, uid);
  if (!ticket) return NextResponse.json({ ok: true, pending: null });

  const preview = await supabaseRest<Record<string, unknown> | null>("rpc/account_merge_preview", {
    method: "POST",
    body: JSON.stringify({ p_a: ticket.session, p_b: ticket.other }),
  }).catch(() => null);

  // The other account was merged away or deleted while the ticket sat in
  // the cookie: there is nothing to decide any more, so say so rather than
  // showing a panel with one account in it.
  if (!preview) return NextResponse.json({ ok: true, pending: null });

  return NextResponse.json({
    ok: true,
    pending: { provider: ticket.via, preview, ticket: raw },
  });
}

/** Giving up on it: the shopper pressed "ไว้ก่อน". */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(MERGE_TICKET_COOKIE);
  return res;
}

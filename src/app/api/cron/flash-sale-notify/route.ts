import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { notifyQueue } from "@/lib/flash-sale-notify";

// Tell whoever's turn just came, and nudge whoever is about to lose their slot.
//
// Driven by pg_cron (public.fs_notify_tick, every 30 seconds), not by a Vercel
// cron: fs_sweep is what grants the slots, it already runs on that clock in the
// database, and the reminder should follow one tick behind the work rather than
// on a separate schedule. The database also checks whether anyone is waiting to
// be told before waking this route, so outside a sale it is never called.
//
// The token it calls with is minted and held by the database itself — see
// authorized() below.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Two callers are allowed, and neither of them needed a secret copied by hand
 * between two systems.
 *
 * pg_cron holds its own token in the database and the database is what checks
 * it: fs_cron_token_ok answers yes or no, so the value never leaves Postgres
 * in either direction. A Vercel cron with CRON_SECRET is still accepted, in
 * case this route is ever scheduled from there again.
 */
async function authorized(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  try {
    return (await supabaseRest<boolean>("rpc/fs_cron_token_ok", {
      method: "POST",
      body: JSON.stringify({ p_token: token }),
    })) === true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Before the token check, which asks the database the same question: an
  // unreachable database should say so rather than look like a bad token.
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await notifyQueue();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] flash-sale notify failed", err);
    return NextResponse.json({ ok: false, error: "notify failed" }, { status: 500 });
  }
}

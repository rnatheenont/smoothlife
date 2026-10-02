import { NextRequest, NextResponse } from "next/server";
import { checkWaitingCases } from "@/lib/inbox-alert";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase-server";

// "Somebody is waiting." See inbox-alert.ts for why it reports a crossing
// rather than a state.
//
// Scheduled from Supabase (pg_cron + pg_net), not vercel.json: a job that runs
// more often than daily is more than the Hobby plan's cron slots allow, and
// adding it there costs the ability to deploy at all. This checks every five
// minutes, so it was never going to live in Vercel.
//
// Three callers are allowed. pg_cron holds its own token in the database and
// the database is what checks it (fs_cron_token_ok — named for the flash sale
// it was written for, but it is the one cron token this project has), so the
// value never has to be copied into Vercel's environment. CRON_SECRET still
// works if this is ever scheduled from Vercel. And an admin can call it by
// hand from a signed-in browser — useful the first time, to see what it would
// say before trusting it to say it unprompted.
async function authorized(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) {
    if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
    try {
      const ok = await supabaseRest<boolean>("rpc/fs_cron_token_ok", {
        method: "POST",
        body: JSON.stringify({ p_token: token }),
      });
      if (ok === true) return true;
    } catch {
      // fall through to the admin cookie
    }
  }
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkWaitingCases();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/inbox-alert] failed", err);
    return NextResponse.json({ ok: false, error: "ตรวจเคสที่รอตอบไม่สำเร็จ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkWaitingCases } from "@/lib/inbox-alert";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// "Somebody is waiting." See inbox-alert.ts for why it reports a crossing
// rather than a state.
//
// Scheduled from Supabase (pg_cron + pg_net), not vercel.json: a job that runs
// more often than daily is more than the Hobby plan's two cron slots allow,
// and adding it there costs the ability to deploy at all. Fifteen minutes is
// the shortest useful interval, so this was never going to live in Vercel.
//
// Admins can call it by hand from a signed-in browser — useful the first time,
// to see what it would say before trusting it to say it unprompted.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromCron = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromCron && !verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
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

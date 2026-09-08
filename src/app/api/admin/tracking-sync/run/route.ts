import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { runSokoSync } from "@/lib/soko-sync-run";

// "Run now" for the tracking sync.
//
// Same work as the cron, different key: CRON_SECRET is stored on Vercel as a
// sensitive value, which means nobody — not even the person who set it — can
// read it back, so triggering a run by hand was impossible without rotating
// it and redeploying everything that depends on it. Staff are already signed
// in to /admin; that is the credential to use.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  const { status, ...body } = await runSokoSync();
  return NextResponse.json(body, { status });
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { recalculateLoyaltyTiers } from "@/lib/loyalty-cron";

// Re-reading everyone's spend and setting their tier from it, on demand.
//
// The nightly cron does this anyway, but "wait until tomorrow" is the wrong
// answer after something that changed what the spend even looks like — today
// the store granted read_all_orders, so a year of purchases became visible at
// once and every tier computed before that was based on sixty days of it.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await recalculateLoyaltyTiers()) });
  } catch (err) {
    console.error("[admin/loyalty/recalculate] failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

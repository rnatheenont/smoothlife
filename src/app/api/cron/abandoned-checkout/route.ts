import { NextRequest, NextResponse } from "next/server";
import { runAbandonedCheckout, abandonedCheckoutEnabled } from "@/lib/abandoned-checkout";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// The nudge to people who reached the payment page and stopped. See
// abandoned-checkout.ts for who that is and, more to the point, who it is not.
//
// An admin can call it from a signed-in browser, which is how to read what it
// would do before letting it do it: without ABANDONED_CHECKOUT_ENABLED=true
// every run is a dry run and sends nothing, so the first look is free.
// `?dry=1` forces that even once the switch is on.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromCron = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromCron && !verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Only an admin at a keyboard may force a dry run; the cron gets the
  // behaviour the switch describes, so a stray query string on a scheduled
  // call cannot quietly turn the job off.
  const dryRun = !fromCron && req.nextUrl.searchParams.get("dry") === "1" ? true : undefined;

  try {
    const result = await runAbandonedCheckout(dryRun === undefined ? {} : { dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/abandoned-checkout] failed", err);
    return NextResponse.json(
      { ok: false, enabled: abandonedCheckoutEnabled(), error: "ตรวจตะกร้าที่ค้างไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

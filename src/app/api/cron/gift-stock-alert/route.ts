import { NextRequest, NextResponse } from "next/server";
import { checkGiftStock } from "@/lib/gift-stock-alert";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// The morning look at the gift shelf. See gift-stock-alert.ts for why it
// reports a crossing rather than a state.
//
// Admins can call it by hand from a signed-in browser — useful the first time,
// to see what it would say before trusting it to say it at nine in the morning.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromCron = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromCron && !verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkGiftStock();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/gift-stock-alert] failed", err);
    return NextResponse.json({ ok: false, error: "ตรวจสต็อกของแถมไม่สำเร็จ" }, { status: 500 });
  }
}

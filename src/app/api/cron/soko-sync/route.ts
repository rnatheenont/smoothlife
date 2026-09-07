import { NextRequest, NextResponse } from "next/server";
import { fetchPackedOrders, sokoConfigured, SokoError } from "@/lib/soko";
import { processTrackingUpdate, logSyncFailure, trackingMode } from "@/lib/tracking-apply";
import { supabaseConfigured } from "@/lib/supabase-server";
import { shopifyAdminConfigured } from "@/lib/shopify-admin";

// Pulls packed orders out of the warehouse system and puts their tracking
// numbers on the matching Shopify orders.
//
// A stopgap, and labelled as one: it screen-scrapes because sokochan's API
// isn't reachable yet. The moment they hand over an API — or point their
// existing webhook at us — this route should be deleted rather than kept
// "just in case", because a scraper that nobody needs is a scraper nobody
// notices breaking.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends the secret as a bearer token; the same header lets a
  // person trigger a run by hand without a second mechanism to secure.
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }
  if (!sokoConfigured()) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า SOKO_USERNAME / SOKO_PASSWORD" }, { status: 503 });
  }

  let rows: { orderRef: string; trackingNumber: string }[];
  try {
    rows = await fetchPackedOrders();
  } catch (err) {
    // A scraper's worst failure is the silent one: the login page changes, the
    // run returns nothing, and everyone assumes there was nothing to send.
    // Recorded so /admin/tracking-sync shows it.
    const message = err instanceof SokoError ? err.message : `ดึงข้อมูลจาก soko ไม่สำเร็จ: ${err}`;
    await logSyncFailure("soko-puller", message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  if (rows.length === 0) {
    // Genuinely normal on a quiet hour, so not an error — but still worth
    // being able to tell apart from a broken run, which is why the failure
    // above writes a row and this does not.
    return NextResponse.json({ ok: true, mode: trackingMode(), found: 0, results: [] });
  }

  const results = [];
  for (const row of rows) {
    // Sequential on purpose: the hourly cap is counted from rows already
    // written, and firing these in parallel would let a batch race past it.
    const r = await processTrackingUpdate({ ...row, source: "soko-puller" });
    results.push({ orderRef: row.orderRef, ...r });
  }

  return NextResponse.json({
    ok: true,
    mode: trackingMode(),
    found: rows.length,
    applied: results.filter((r) => r.applied).length,
    conflicts: results.filter((r) => r.action === "conflict").length,
    results,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseConfigured } from "@/lib/supabase-server";
import { shopifyAdminConfigured } from "@/lib/shopify-admin";
import { processTrackingUpdate, trackingMode } from "@/lib/tracking-apply";

// Receives a tracking number from the warehouse system.
//
// The decision, the guards and the logging all live in tracking-apply, shared
// with the scheduled puller — two ways into a store that emails customers is
// exactly how one of them ends up quietly missing a check.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compared in constant time, and only after a length check, so the comparison
 * itself can't be used to guess the secret one character at a time.
 */
function authorised(req: NextRequest): boolean {
  const expected = process.env.TRACKING_WEBHOOK_SECRET;
  if (!expected) return false;
  // A header, not a query parameter: query strings end up in the access logs
  // of every proxy the request passes through.
  const given = req.headers.get("x-tracking-secret") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const orderRef = typeof body?.orderRef === "string" ? body.orderRef.trim() : "";
  const trackingNumber = typeof body?.trackingNumber === "string" ? body.trackingNumber.trim() : "";
  if (!orderRef || !trackingNumber) {
    return NextResponse.json({ ok: false, error: "ต้องมี orderRef และ trackingNumber" }, { status: 400 });
  }

  const result = await processTrackingUpdate({
    orderRef,
    trackingNumber,
    courier: typeof body?.courier === "string" ? body.courier : undefined,
    source: typeof body?.source === "string" ? body.source : "soko",
  });

  // Says plainly whether anything happened in Shopify, so the sending system
  // can never read a 200 as "the tracking number is now live".
  return NextResponse.json({ ok: true, mode: trackingMode(), ...result });
}

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getOrderForTrackingSync, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { decide, SyncMode } from "@/lib/tracking-sync";

// Receives a tracking number from the warehouse system and records what it
// would do with it.
//
// Starts in dry-run: it resolves the order, decides, writes a row to
// tracking_sync_log, and touches Shopify not at all. That is deliberate —
// this store has real customers ordering through it right now, and the one
// thing that cannot be undone is a shipping email sent to the wrong person.
// The mode only moves on once the log shows the matching is right.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mode(): SyncMode {
  const m = process.env.TRACKING_SYNC_MODE;
  return m === "write" || m === "write-notify" ? m : "dry-run";
}

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
  const courier = typeof body?.courier === "string" ? body.courier.trim() : "Kerry Express Thailand";
  const source = typeof body?.source === "string" ? body.source.trim().slice(0, 40) : "soko";

  if (!orderRef || !trackingNumber) {
    return NextResponse.json(
      { ok: false, error: "ต้องมี orderRef และ trackingNumber" },
      { status: 400 }
    );
  }

  const order = await getOrderForTrackingSync(orderRef);
  const decision = decide(
    order && {
      name: order.name,
      financialStatus: order.financialStatus,
      cancelled: order.cancelled,
      shipments: order.shipments,
    },
    trackingNumber
  );

  const currentMode = mode();
  // Write mode is not implemented yet, on purpose: the switch exists so the
  // rollout is a config change rather than a code change, but nothing here
  // can reach Shopify until that step is deliberately built and reviewed.
  const applied = false;

  await supabaseRest("tracking_sync_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      source,
      mode: currentMode,
      order_ref: orderRef,
      tracking_number: trackingNumber,
      courier,
      resolved_order_name: order?.name ?? null,
      action: decision.action,
      reason: decision.reason,
      existing_numbers: decision.action === "conflict" ? decision.existing : null,
      applied,
      notified: false,
    }),
  }).catch((err) => console.error("[webhooks/tracking] could not log", err));

  return NextResponse.json({
    ok: true,
    mode: currentMode,
    order: order?.name ?? null,
    action: decision.action,
    reason: decision.reason,
    // Says plainly that nothing happened in Shopify, so the sending system
    // can't read a 200 as "the tracking number is now live".
    applied,
  });
}

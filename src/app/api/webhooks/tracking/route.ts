import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getOrderForTrackingSync, setFulfillmentTracking, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { decide, SyncMode, MAX_FILLS_PER_HOUR } from "@/lib/tracking-sync";

// Receives a tracking number from the warehouse system and records what it
// would do with it.
//
// Three modes, and the default is the timid one:
//
//   dry-run      (default, and what anything unset means) — resolve, decide,
//                log. Shopify is not touched.
//   write        — fill in a missing tracking number. No customer email.
//   write-notify — the same, and Shopify emails the customer.
//
// The order matters because the last step cannot be undone: a shipping email
// sent to the wrong person stays sent. This store has real customers ordering
// through it right now, so each mode is meant to be run long enough to be
// boring before the next one is switched on.

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

/** How many orders this integration has actually written to in the last hour. */
async function countFillsLastHour(): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const rows = await supabaseRest<{ id: string }[]>(
      `tracking_sync_log?applied=is.true&received_at=gte.${encodeURIComponent(since)}&select=id&limit=${MAX_FILLS_PER_HOUR + 1}`
    );
    return rows.length;
  } catch {
    // Can't count means can't be sure we're under the cap. Treat that as
    // being over it: the cap exists for the case where something is wrong.
    return MAX_FILLS_PER_HOUR;
  }
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
  let applied = false;
  let notified = false;
  let error: string | null = null;

  // Only ever "fill". "conflict" is left for a person on purpose, and
  // "already-set" is the case that must stay silent — writing again would
  // re-send the shipping email for a parcel already announced.
  if (currentMode !== "dry-run" && decision.action === "fill" && order?.fulfillmentId) {
    // A run that suddenly wants to change far more orders than a normal day
    // is the shape a mapping bug takes. Stopping and being asked about it
    // beats being right 190 times and wrong 200.
    const recent = await countFillsLastHour();
    if (recent >= MAX_FILLS_PER_HOUR) {
      error = `หยุดชั่วคราว: เขียนไปแล้ว ${recent} รายการในชั่วโมงนี้ (เพดาน ${MAX_FILLS_PER_HOUR})`;
    } else {
      notified = currentMode === "write-notify";
      const res = await setFulfillmentTracking({
        fulfillmentId: order.fulfillmentId,
        number: trackingNumber,
        company: courier,
        notifyCustomer: notified,
      });
      if (res.ok) {
        applied = true;
      } else {
        error = res.error ?? "เขียนลง Shopify ไม่สำเร็จ";
        notified = false;
      }
    }
  } else if (currentMode !== "dry-run" && decision.action === "fill" && !order?.fulfillmentId) {
    // The order has no fulfillment to attach a number to. Creating one would
    // mark the items shipped, which is a different and bigger claim than
    // "here is the parcel number" — that stays a human's decision.
    error = "ออเดอร์ยังไม่ได้ fulfill — ต้องกด fulfill ใน Shopify ก่อน";
  }

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
      notified,
      error,
    }),
  }).catch((err) => console.error("[webhooks/tracking] could not log", err));

  return NextResponse.json({
    ok: true,
    mode: currentMode,
    order: order?.name ?? null,
    action: decision.action,
    reason: decision.reason,
    // Says plainly whether anything happened in Shopify, so the sending
    // system can never read a 200 as "the tracking number is now live".
    applied,
    notified,
    error,
  });
}

import { supabaseRest } from "@/lib/supabase-server";
import { aftershipConfigured, registerTracking } from "@/lib/aftership";
import { markRegistered } from "@/lib/shipment-store";
import {
  getOrderForTrackingSync,
  setFulfillmentTracking,
  createFulfillmentWithTracking,
} from "@/lib/shopify-admin";
import { decide, SyncMode, MAX_FILLS_PER_HOUR } from "@/lib/tracking-sync";

// One tracking number, from wherever it came, put through the same decision
// and the same guards.
//
// Extracted so the webhook and the scheduled puller cannot drift apart. Two
// paths into a store that emails customers is exactly the kind of thing that
// ends up with one of them quietly missing a check.

export function trackingMode(): SyncMode {
  const m = process.env.TRACKING_SYNC_MODE;
  return m === "write" || m === "write-notify" ? m : "dry-run";
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
    // Can't count means can't be sure we're under the cap. Treat that as being
    // over it: the cap exists for the case where something is already wrong.
    return MAX_FILLS_PER_HOUR;
  }
}

export type ProcessResult = {
  order: string | null;
  action: string;
  reason: string;
  applied: boolean;
  notified: boolean;
  error: string | null;
};

export async function processTrackingUpdate(input: {
  orderRef: string;
  trackingNumber: string;
  courier?: string;
  source?: string;
  /** soko's own reference. Differs from orderRef only for a second box. */
  parcelRef?: string;
}): Promise<ProcessResult> {
  const courier = input.courier?.trim() || "Kerry Express Thailand";
  const source = input.source?.trim().slice(0, 40) || "webhook";
  const mode = trackingMode();

  const order = await getOrderForTrackingSync(input.orderRef);
  const decision = decide(
    order && {
      name: order.name,
      financialStatus: order.financialStatus,
      cancelled: order.cancelled,
      shipments: order.shipments,
    },
    input.trackingNumber,
    Boolean(input.parcelRef && input.parcelRef !== input.orderRef)
  );

  let applied = false;
  let notified = false;
  let error: string | null = null;

  // Only ever "fill". "conflict" is left for a person by design, and
  // "already-set" must stay silent — writing again would re-send the shipping
  // email for a parcel already announced.
  if (mode !== "dry-run" && decision.action === "fill" && order) {
    const recent = await countFillsLastHour();
    if (recent >= MAX_FILLS_PER_HOUR) {
      error = `หยุดชั่วคราว: เขียนไปแล้ว ${recent} รายการในชั่วโมงนี้ (เพดาน ${MAX_FILLS_PER_HOUR})`;
    } else {
      notified = mode === "write-notify";
      const res = order.fulfillmentId
        ? await setFulfillmentTracking({
            fulfillmentId: order.fulfillmentId,
            number: input.trackingNumber,
            company: courier,
            notifyCustomer: notified,
          })
        : order.openFulfillmentOrderIds.length > 0
          ? await createFulfillmentWithTracking({
              fulfillmentOrderIds: order.openFulfillmentOrderIds,
              number: input.trackingNumber,
              company: courier,
              notifyCustomer: notified,
            })
          : { ok: false, error: "ไม่มี fulfillment order ที่เปิดอยู่ — ต้องให้แอดมินตรวจสอบ" };

      if (res.ok) {
        applied = true;
        // Watching every parcel from the moment its number is real is the best
        // experience and the most expensive one: courier feeds charge per
        // parcel, and this store ships 300-500 a month while only a fraction
        // of those orders are ever opened by anyone. Off by default, so the
        // quota is spent on parcels a customer actually looked at (see
        // shipment-sync.ts); turn it on when the plan is big enough not to
        // care.
        void (async () => {
          try {
            if (process.env.COURIER_WATCH_EVERY_PARCEL !== "1") return;
            if (aftershipConfigured() && (await registerTracking(input.trackingNumber))) {
              await markRegistered(input.trackingNumber, courier);
            }
          } catch (err) {
            console.error("[tracking-apply] could not register with the courier feed", err);
          }
        })();
      } else {
        error = res.error ?? "เขียนลง Shopify ไม่สำเร็จ";
        notified = false;
      }
    }
  }

  await supabaseRest("tracking_sync_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      source,
      mode,
      order_ref: input.parcelRef || input.orderRef,
      tracking_number: input.trackingNumber,
      courier,
      resolved_order_name: order?.name ?? null,
      action: decision.action,
      reason: decision.reason,
      existing_numbers: decision.action === "conflict" ? decision.existing : null,
      applied,
      notified,
      error,
    }),
  }).catch((err) => console.error("[tracking-apply] could not log", err));

  return {
    order: order?.name ?? null,
    action: decision.action,
    reason: decision.reason,
    applied,
    notified,
    error,
  };
}

/**
 * Records that a whole run failed, so a puller that stops working leaves a
 * trace instead of simply going quiet — the failure mode that matters most
 * for a scraper nobody is watching.
 */
/**
 * A row for a run that worked and had nothing to do.
 *
 * Without one, a healthy quiet day and a scraper that has stopped seeing
 * anything produce exactly the same evidence: no rows. That ambiguity has cost
 * two days of this integration already — once when it was reading the same ten
 * orders forever, and again when every run was dying on a timeout. A heartbeat
 * makes "no log at all" mean one thing only: it did not run.
 */
export async function logSyncHeartbeat(
  source: string,
  detail: { pagesScanned?: number; candidates?: number; skipped?: number; ranOutOfTime?: boolean }
) {
  const parts = [
    `อ่าน ${detail.pagesScanned ?? "?"} หน้า`,
    `พบ ${detail.candidates ?? "?"} ออเดอร์`,
    `ข้ามที่ทำไปแล้ว ${detail.skipped ?? 0}`,
  ];
  if (detail.ranOutOfTime) parts.push("อ่านไม่ครบ (ใกล้หมดเวลา)");
  await supabaseRest("tracking_sync_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      source,
      mode: trackingMode(),
      order_ref: "-",
      tracking_number: "-",
      action: "run-empty",
      reason: `ไม่มีเลขใหม่ — ${parts.join(" · ")}`,
      applied: false,
      notified: false,
    }),
  }).catch(() => {});
}

export async function logSyncFailure(source: string, message: string) {
  await supabaseRest("tracking_sync_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      source,
      mode: trackingMode(),
      order_ref: "-",
      tracking_number: "-",
      action: "run-failed",
      reason: message.slice(0, 500),
      applied: false,
      notified: false,
      error: message.slice(0, 500),
    }),
  }).catch(() => {});
}

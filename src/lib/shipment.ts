import type { ShipmentStatus, CourierEvent } from "@/lib/courier";

// Turns what we know about an order into the row of steps the customer sees.
//
// The important rule here is that a step is only marked "done" when something
// actually told us so. Shopify can prove the first three; the last two need
// scan events from the courier, which we do not have yet (see courier.ts). So
// the tracker shows those steps greyed out and says why, instead of quietly
// implying a parcel is out for delivery because it was shipped a while ago.

export type StepKey = "confirmed" | "processing" | "shipped" | "out_for_delivery" | "delivered";

export type Step = {
  key: StepKey;
  label: string;
  /** "done" — proven. "current" — the furthest proven step. "todo" — not yet. */
  state: "done" | "current" | "todo";
  at: string | null;
  /** True when this step is inferred from age rather than reported to us. */
  assumed?: boolean;
};

// How long a parcel may go unreported before the tracker calls it delivered.
//
// Kerry's domestic service is one to four days and nobody sends us a delivery
// scan, so a parcel handed over in June sat at "เข้าระบบขนส่งแล้ว" forever —
// a customer looking at an order from three months ago was shown a delivery
// still in progress. After two weeks of silence the overwhelmingly likely
// truth is that it arrived, and the tracker says so while marking the step as
// inferred rather than reported. A customer who did not receive it tells us,
// and that always beats an inference.
const ASSUME_DELIVERED_AFTER_DAYS = 14;

const STEP_LABELS: Record<StepKey, string> = {
  confirmed: "ยืนยันคำสั่งซื้อ",
  processing: "กำลังเตรียมพัสดุ",
  shipped: "เข้าระบบขนส่งแล้ว",
  out_for_delivery: "กำลังนำจ่าย",
  delivered: "จัดส่งสำเร็จ",
};

const ORDER: StepKey[] = ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"];

/** Where a courier's own status sits on our ladder. */
const STATUS_TO_STEP: Record<ShipmentStatus, StepKey> = {
  confirmed: "confirmed",
  processing: "processing",
  ready_to_ship: "processing",
  shipped: "shipped",
  in_transit: "shipped",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  failed: "out_for_delivery",
};

export type ShipmentInput = {
  paidAt: string | null;
  /** Shopify fulfillment created — the parcel was handed over. */
  shippedAt: string | null;
  deliveredAt: string | null;
  events: CourierEvent[];
};

export function deriveSteps(input: ShipmentInput): Step[] {
  const at: Partial<Record<StepKey, string>> = {};

  if (input.paidAt) {
    at.confirmed = input.paidAt;
    // Paying is what starts packing, so "preparing" is true from the same
    // moment — Shopify has no separate "started packing" timestamp and
    // inventing one would be a guess presented as a fact.
    at.processing = input.paidAt;
  }
  if (input.shippedAt) at.shipped = input.shippedAt;
  if (input.deliveredAt) at.delivered = input.deliveredAt;

  for (const e of input.events) {
    if (!e.statusCode) continue;
    const key = STATUS_TO_STEP[e.statusCode];
    // Earliest event wins: the first scan that proves a step is when it
    // happened, not the most recent one that happens to still match.
    if (!at[key] || e.eventTime < at[key]!) at[key] = e.eventTime;
  }

  // Nothing since the hand-over, and long enough ago that "still on its way"
  // stopped being the likely reading.
  const stale =
    !at.delivered &&
    !at.out_for_delivery &&
    input.events.length === 0 &&
    input.shippedAt !== null &&
    Date.now() - new Date(input.shippedAt).getTime() > ASSUME_DELIVERED_AFTER_DAYS * 86_400_000;

  const assumedKeys = new Set<StepKey>();
  if (stale) {
    for (const key of ["out_for_delivery", "delivered"] as StepKey[]) assumedKeys.add(key);
  }

  const lastProven = stale ? "delivered" : [...ORDER].reverse().find((k) => at[k]);
  const furthest = lastProven ? ORDER.indexOf(lastProven) : -1;

  return ORDER.map((key, i) => ({
    key,
    label: STEP_LABELS[key],
    // No timestamp on an inferred step: a date nobody recorded would be an
    // invention, and the caption already explains where the step came from.
    at: at[key] ?? null,
    assumed: assumedKeys.has(key) || undefined,
    // Steps before the furthest proven one count as done even with no
    // timestamp of their own. A parcel that is confirmed delivered must have
    // gone out for delivery, whether or not anyone scanned it doing so, and
    // leaving that step grey draws a hole in the middle of the row that reads
    // as "something went wrong" rather than "nobody told us the minute".
    state: i > furthest ? "todo" : key === lastProven ? "current" : "done",
  }));
}

/** The furthest step we can actually prove, or null before anything is known. */
export function furthestStep(steps: Step[]): StepKey | null {
  return steps.find((s) => s.state === "current")?.key ?? null;
}

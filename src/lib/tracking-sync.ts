import type { ShopifyShipment } from "@/lib/shopify-admin";

// Decides what to do when an outside system (the warehouse / soko) tells us a
// tracking number for an order. The decision is separated from anything that
// performs it so the same logic can run in dry-run — where it decides and
// records, and touches nothing — and later in write mode unchanged.
//
// Nothing here calls Shopify. That is the point: the whole first phase of
// this integration is meant to prove the matching is right against a live
// store with real customers on it, without writing anything to that store.

export type SyncMode = "dry-run" | "write" | "write-notify";

export type SyncDecision =
  | { action: "fill"; reason: string }
  | { action: "already-set"; reason: string }
  | { action: "conflict"; reason: string; existing: string[] }
  | { action: "no-order"; reason: string }
  | { action: "not-eligible"; reason: string };

export type OrderForSync = {
  name: string;
  financialStatus: string | null;
  cancelled: boolean;
  shipments: Pick<ShopifyShipment, "number">[];
};

/** Tracking numbers only ever differ by case/spacing between systems. */
function normalise(n: string) {
  return n.trim().toUpperCase().replace(/\s+/g, "");
}

export function decide(
  order: OrderForSync | null,
  incoming: string,
  /**
   * soko filed this under its own reference rather than the order number —
   * "#4161_F" is the follow-up box sent when the first shipment went out
   * short. Those are handled outside this sync, so they are recorded and
   * left alone rather than written to Shopify.
   */
  followUpParcel = false
): SyncDecision {
  const number = normalise(incoming);
  if (!number) return { action: "not-eligible", reason: "ไม่มีเลขพัสดุในข้อมูลที่ส่งมา" };

  // No fuzzy matching anywhere: an order we cannot identify exactly is an
  // order we do not touch.
  if (!order) return { action: "no-order", reason: "ไม่พบออเดอร์นี้ใน Shopify" };

  // Follow-up boxes are somebody else's job. Checked before the number
  // comparisons so one never reads as a conflict and starts asking a person
  // about a decision that has already been made here.
  if (followUpParcel) {
    return { action: "not-eligible", reason: "ของส่งตาม (_F) — ไม่ใส่ให้ตามที่ตั้งค่าไว้" };
  }

  if (order.cancelled) {
    return { action: "not-eligible", reason: "ออเดอร์ถูกยกเลิกแล้ว" };
  }
  if (order.financialStatus && !["PAID", "PARTIALLY_PAID"].includes(order.financialStatus)) {
    return { action: "not-eligible", reason: `สถานะการชำระเงินคือ ${order.financialStatus}` };
  }

  const existing = order.shipments.map((s) => normalise(s.number)).filter(Boolean);

  // Same number arriving twice — a retry, a duplicate webhook, or the number
  // a person already keyed. Doing nothing is the correct outcome: writing
  // again would re-send the shipping email for a parcel already announced.
  if (existing.includes(number)) {
    return { action: "already-set", reason: "เลขนี้อยู่ในออเดอร์แล้ว ไม่ต้องทำอะไร" };
  }

  // Two systems claiming different numbers for one order. Which is right is
  // not something this code can know — one of them is a typo, and guessing
  // wrong sends a customer to somebody else's parcel.
  if (existing.length > 0) {
    return {
      action: "conflict",
      reason: "ออเดอร์นี้มีเลขพัสดุอยู่แล้ว และไม่ตรงกับเลขที่ส่งมา — ต้องให้แอดมินตรวจสอบ",
      existing: order.shipments.map((s) => s.number),
    };
  }

  return { action: "fill", reason: "ยังไม่มีเลขพัสดุ พร้อมเติม" };
}

/**
 * A batch that suddenly wants to change far more orders than a normal day is
 * the shape a mapping bug takes. Better to stop the whole run and be asked
 * about it than to be right 190 times and wrong 200.
 */
export const MAX_FILLS_PER_HOUR = 60;

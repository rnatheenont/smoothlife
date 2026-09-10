// Shopify's order statuses in Thai, shared by the order list and the order
// detail page so the same order can't be described two different ways
// depending on which screen you're looking at.

export const fulfillmentLabel: Record<string, string> = {
  FULFILLED: "จัดส่งแล้ว",
  IN_PROGRESS: "กำลังเตรียมจัดส่ง",
  PARTIALLY_FULFILLED: "จัดส่งบางส่วน",
  UNFULFILLED: "รอดำเนินการ",
  PENDING_FULFILLMENT: "รอดำเนินการ",
  ON_HOLD: "พักคำสั่งซื้อ",
  OPEN: "เปิดอยู่",
  SCHEDULED: "กำหนดส่งแล้ว",
  RESTOCKED: "คืนสต็อกแล้ว",
  REQUEST_DECLINED: "คำขอถูกปฏิเสธ",
};

const fulfillmentColor: Record<string, string> = {
  FULFILLED: "bg-emerald-100 text-emerald-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  PARTIALLY_FULFILLED: "bg-sky-100 text-sky-700",
  UNFULFILLED: "bg-amber-100 text-amber-700",
  PENDING_FULFILLMENT: "bg-amber-100 text-amber-700",
  ON_HOLD: "bg-slate-100 text-slate-600",
  OPEN: "bg-amber-100 text-amber-700",
  SCHEDULED: "bg-sky-100 text-sky-700",
  RESTOCKED: "bg-slate-100 text-slate-600",
  REQUEST_DECLINED: "bg-rose-100 text-rose-700",
};

export const financialLabel: Record<string, string> = {
  PAID: "ชำระเงินแล้ว",
  PENDING: "รอชำระเงิน",
  PARTIALLY_PAID: "ชำระบางส่วน",
  REFUNDED: "คืนเงินแล้ว",
  PARTIALLY_REFUNDED: "คืนเงินบางส่วน",
  VOIDED: "ยกเลิกรายการ",
  AUTHORIZED: "อนุมัติวงเงินแล้ว",
  EXPIRED: "ชำระเงินไม่สำเร็จ",
};

export function fulfillmentBadge(status: string | null) {
  const s = status || "UNFULFILLED";
  return {
    // Never the raw enum. Shopify adds statuses over time and the fallback
    // used to print them verbatim, so a customer would have been shown
    // "REQUEST_DECLINED" or whatever they invent next — English, shouting, and
    // meaningless. A vague Thai phrase is a better answer than a precise
    // one nobody can read.
    label: fulfillmentLabel[s] || "อยู่ระหว่างดำเนินการ",
    color: fulfillmentColor[s] || "bg-slate-100 text-slate-600",
  };
}

/**
 * The payment line under the order number, or null when we have nothing safe
 * to say. Same reasoning as the badge: silence beats an untranslated enum.
 */
export function financialText(status: string | null): string | null {
  if (!status) return null;
  return financialLabel[status] ?? null;
}

/** Shopify order GID → the numeric id used in our own URLs. */
export function orderIdFromGid(gid: string): string {
  return gid.split("/").pop() || gid;
}

/**
 * What to show as the order's headline state.
 *
 * Shopify keeps payment and fulfillment as two independent fields, and reading
 * only the fulfillment one told a customer her fully refunded, closed order was
 * "รอดำเนินการ" — as if a parcel were still coming. Money decides first: a
 * cancelled or fully refunded order is finished whatever its fulfillment field
 * still says, because nothing is going to be shipped.
 */
export function orderStateBadge(order: {
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt?: string | null;
}): { label: string; color: string } {
  if (order.cancelledAt) return { label: "ยกเลิกแล้ว", color: "bg-slate-100 text-slate-600" };
  if (order.financialStatus === "REFUNDED") return { label: "คืนเงินแล้ว", color: "bg-slate-100 text-slate-600" };
  if (order.financialStatus === "VOIDED") return { label: "ยกเลิกรายการ", color: "bg-slate-100 text-slate-600" };
  // EXPIRED is Shopify's word for a checkout that was never paid for. The
  // store has dozens, some over a year old, and calling them "รอดำเนินการ"
  // told those customers a parcel was on its way — for an order that was
  // never paid and will never ship.
  if (order.financialStatus === "EXPIRED") {
    return { label: "ไม่ได้ชำระเงิน", color: "bg-slate-100 text-slate-600" };
  }
  return fulfillmentBadge(order.fulfillmentStatus);
}

/**
 * Whether a parcel is still expected — the question the tracker answers.
 *
 * A refunded order with nothing shipped has no journey to draw, and five grey
 * steps under it read as "your order is stuck" rather than "this one is over".
 */
export function stillShipping(order: {
  financialStatus: string | null;
  cancelledAt?: string | null;
  shipments?: { number: string }[];
}): boolean {
  if (order.cancelledAt) return false;
  const done =
    order.financialStatus === "REFUNDED" ||
    order.financialStatus === "VOIDED" ||
    order.financialStatus === "EXPIRED";
  // A refunded order that already shipped keeps its tracker: the parcel is
  // real, and it may be the return the customer is watching.
  return !done || (order.shipments?.length ?? 0) > 0;
}

// How long a paid order may sit unshipped before saying so out loud.
const STALLED_AFTER_DAYS = 30;

/**
 * A paid order that never shipped and has stopped being plausible.
 *
 * The store has orders from last year still sitting at "รอดำเนินการ" — a
 * customer opening one sees a tracker parked at "กำลังเตรียมพัสดุ" as though a
 * parcel were being packed for them fourteen months later. Better to admit
 * something went wrong and point them at a person.
 */
export function stalledOrder(order: {
  createdAt: string;
  financialStatus: string | null;
  cancelledAt?: string | null;
  shipments?: { number: string }[];
}): boolean {
  if (order.cancelledAt) return false;
  if (order.financialStatus !== "PAID" && order.financialStatus !== "PARTIALLY_REFUNDED") return false;
  if ((order.shipments?.length ?? 0) > 0) return false;
  const age = Date.now() - new Date(order.createdAt).getTime();
  return Number.isFinite(age) && age > STALLED_AFTER_DAYS * 86_400_000;
}

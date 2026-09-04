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
  EXPIRED: "หมดอายุ",
};

export function fulfillmentBadge(status: string | null) {
  const s = status || "UNFULFILLED";
  return {
    label: fulfillmentLabel[s] || s,
    color: fulfillmentColor[s] || "bg-slate-100 text-slate-600",
  };
}

/** Shopify order GID → the numeric id used in our own URLs. */
export function orderIdFromGid(gid: string): string {
  return gid.split("/").pop() || gid;
}

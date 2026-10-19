// What the shop says about an order, in one place.
//
// Two channels tell a customer the same five things — a LINE card and an
// email — and each one used to carry its own copy of the vocabulary. The
// copies are the problem: a cancel reason worded one way in LINE and another
// way in email is the shop contradicting itself, and nobody finds out,
// because nobody receives both and compares them.

export type OrderEventKind = "paid" | "shipped" | "delivered" | "refunded" | "cancelled";

/**
 * The order number the customer knows.
 *
 * A fulfillment is named "#1001.1" — still order #1001 to them. Falling back
 * to the raw Shopify id is a last resort, and it is still better than an
 * empty space where the order number should be.
 */
export function orderLabel(name: string | undefined | null, fallbackId: string | number): string {
  const clean = (name ?? "").split(".")[0].trim();
  return clean || `#${fallbackId}`;
}

export type Tracking = { company: string | null; number: string | null; url: string | null };

export function trackingOf(fulfillment: {
  tracking_company?: string;
  tracking_number?: string;
  tracking_urls?: string[];
  tracking_url?: string;
}): Tracking {
  return {
    company: fulfillment.tracking_company || null,
    number: fulfillment.tracking_number || null,
    url: fulfillment.tracking_urls?.[0] || fulfillment.tracking_url || null,
  };
}

/**
 * Shopify's cancel reasons, in words a customer would use.
 *
 * Anything not in here is left out rather than shown raw: "inventory" on its
 * own reads as a system fault, and an English word in a Thai message reads as
 * something leaking out of the back office. The six keys are the whole of
 * Shopify's OrderCancelReason enum, checked against the GraphQL schema rather
 * than guessed.
 */
export const CANCEL_REASON_TH: Record<string, string> = {
  customer: "ลูกค้าขอยกเลิก",
  inventory: "สินค้าไม่พอจัดส่ง",
  fraud: "ตรวจพบความผิดปกติของการชำระเงิน",
  declined: "การชำระเงินไม่สำเร็จ",
  staff: "ยกเลิกโดยทางร้าน",
  other: "ยกเลิกโดยทางร้าน",
};

/** The customer's own words for a cancel reason, or nothing at all. */
export function cancelReasonTh(reason: string | null | undefined): string | null {
  return CANCEL_REASON_TH[(reason ?? "").toLowerCase()] ?? null;
}

export function baht(amount: number): string {
  return `฿${Math.round(amount).toLocaleString("th-TH")}`;
}

export function points(n: number): string {
  return `${n.toLocaleString("th-TH")} แต้ม`;
}

export type OrderItem = { name: string; quantity: number };

/**
 * What was bought, at most three of it.
 *
 * Kept as name and quantity rather than one string because the two channels
 * lay them out differently: a LINE card has one column and writes "x2" after
 * the name, an email has a table and puts the count in its own column, where
 * a long product name wrapping onto a second line cannot be mistaken for the
 * next product.
 */
export function orderItems(
  lineItems: { title?: string; name?: string; quantity?: number }[],
  max = 3
): { shown: OrderItem[]; more: number } {
  return {
    shown: lineItems.slice(0, max).map((li) => ({
      name: (li.title || li.name || "").trim() || "สินค้า",
      quantity: li.quantity && li.quantity > 0 ? li.quantity : 1,
    })),
    more: Math.max(0, lineItems.length - max),
  };
}

/** "ชื่อสินค้า x2", at most three of them plus a count of the rest. */
export function itemLines(lineItems: { title?: string; name?: string; quantity?: number }[]): string[] {
  const { shown, more } = orderItems(lineItems);
  const lines = shown.map((it) => `${it.name}${it.quantity > 1 ? ` x${it.quantity}` : ""}`);
  if (more > 0) lines.push(`และอีก ${more} รายการ`);
  return lines;
}

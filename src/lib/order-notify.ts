import * as line from "@/lib/line-order-notify";
import * as mail from "@/lib/email-order-notify";

// One call per thing that happens to an order, two channels out.
//
// The webhook used to call the LINE module directly at eight places. Adding
// email there would have meant sixteen calls and eight chances to add one and
// forget the other — which is exactly how a shop ends up telling half its
// customers their parcel shipped.
//
// Both channels always run, and neither can stop the other: a customer may
// have LINE, or an inbox, or both, and the one we can reach is not something
// this layer should be deciding. Promise.all rather than awaiting in turn
// because the webhook is holding Shopify's connection open the whole time,
// and these are two independent network calls.

export type Notified = {
  line: { sent: boolean; reason?: string };
  email: { sent: boolean; reason?: string };
};

/**
 * Runs both, and survives either one throwing.
 *
 * Both modules are written to return a reason rather than throw, so a
 * rejection here is a bug rather than an expected path — but a bug in a
 * notification must not cost a customer their points, so it is caught,
 * reported in the result, and logged.
 */
async function both(
  kind: string,
  orderId: string | number,
  lineCall: Promise<{ sent: boolean; reason?: string }>,
  mailCall: Promise<{ sent: boolean; reason?: string }>
): Promise<Notified> {
  const fallback = (err: unknown) => {
    console.error(`[order-notify] ${kind} ${orderId} threw`, err);
    return { sent: false, reason: "notifier threw" };
  };
  const [lineResult, emailResult] = await Promise.all([
    lineCall.catch(fallback),
    mailCall.catch(fallback),
  ]);
  return { line: lineResult, email: emailResult };
}

export function notifyOrderPaid(opts: {
  order: {
    id: string | number;
    name?: string;
    email?: string;
    current_total_price?: string;
    total_price?: string;
    line_items?: { title?: string; quantity?: number }[];
  };
  userId?: string | null;
  points: number;
  balance: number | null;
}): Promise<Notified> {
  return both(
    "paid",
    opts.order.id,
    line.notifyOrderPaid(opts),
    mail.emailOrderPaid({ order: opts.order, points: opts.points, balance: opts.balance })
  );
}

export function notifyOrderShipped(opts: {
  orderId: string | number;
  orderName?: string;
  email?: string | null;
  userId?: string | null;
  fulfillment: { tracking_company?: string; tracking_number?: string; tracking_urls?: string[] };
  items?: { title?: string; quantity?: number }[];
}): Promise<Notified> {
  return both("shipped", opts.orderId, line.notifyOrderShipped(opts), mail.emailOrderShipped(opts));
}

export function notifyOrderDelivered(opts: {
  orderId: string | number;
  orderName?: string;
  email?: string | null;
  userId?: string | null;
}): Promise<Notified> {
  return both("delivered", opts.orderId, line.notifyOrderDelivered(opts), mail.emailOrderDelivered(opts));
}

export function notifyOrderRefunded(opts: {
  orderId: string | number;
  orderName?: string;
  userId?: string | null;
  email?: string | null;
  amount: number;
  pointsReversed: number;
}): Promise<Notified> {
  return both("refunded", opts.orderId, line.notifyOrderRefunded(opts), mail.emailOrderRefunded(opts));
}

export function notifyOrderCancelled(opts: {
  orderId: string | number;
  orderName?: string;
  userId?: string | null;
  email?: string | null;
  reason?: string | null;
  pointsReversed?: number;
  refunded?: boolean;
}): Promise<Notified> {
  return both("cancelled", opts.orderId, line.notifyOrderCancelled(opts), mail.emailOrderCancelled(opts));
}

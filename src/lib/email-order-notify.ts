import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { emailConfigured, sendEmail } from "@/lib/email";
import {
  orderPaidEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderRefundedEmail,
  orderCancelledEmail,
  type OrderEmail,
} from "@/lib/email-order";
import { orderLabel, type OrderEventKind } from "@/lib/order-events";

// Telling the customer what happened to their order, in the inbox everyone
// has — the half of the audience LINE never reaches. A guest who checked out
// without an account has no LINE identity and no account page; this is the
// only way they ever hear that their parcel shipped.
//
// Everything here is best-effort and deliberately unable to break the webhook
// that calls it: no address, no Resend key, a send Resend refuses — each
// returns a reason and nothing else. Points must still be credited and
// referrals still advanced when a notification cannot be sent.

type Sent = { sent: boolean; reason?: string };

/**
 * Claims the right to send this email, or says it is already sent.
 *
 * Shopify redelivers webhooks on any hiccup, and fulfillments/update fires
 * again on every courier scan — "your parcel arrived" three times is worse in
 * an inbox than in a chat, because each copy sits there. The insert is the
 * lock: whoever gets the row back sends, everyone else stops here.
 */
async function claim(orderId: string, kind: OrderEventKind, email: string, orderName: string): Promise<boolean> {
  const rows = await supabaseRest<{ id: string }[]>("email_order_notifications?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ id: `${orderId}:${kind}`, email, kind, order_name: orderName }),
  }).catch((): { id: string }[] => []);
  return rows.length > 0;
}

/**
 * What an earlier email for this order already worked out.
 *
 * Two things arrive incomplete later in an order's life: a fulfillment or
 * refund webhook carries no customer email, and neither carries the "#1042"
 * the customer knows the order by. The message sent when they paid knew both,
 * so the rest of the order's mail borrows them from it rather than going back
 * to Shopify — or, worse, mailing nobody at all.
 */
async function priorFor(orderId: string): Promise<{ email: string; order_name: string | null } | null> {
  const [row] = await supabaseRest<{ email: string; order_name: string | null }[]>(
    `email_order_notifications?id=like.${encodeURIComponent(`${orderId}:*`)}` +
      `&select=email,order_name&order=sent_at.asc&limit=1`
  ).catch((): { email: string; order_name: string | null }[] => []);
  return row ?? null;
}

/** Undoes a claim whose send never arrived, so Shopify's retry can try again. */
async function release(orderId: string, kind: OrderEventKind) {
  await supabaseRest(`email_order_notifications?id=eq.${pgValue(`${orderId}:${kind}`)}`, {
    method: "DELETE",
    returning: false,
  }).catch(() => {});
}

/**
 * Resolve, claim, render, send.
 *
 * The message is built after the claim rather than before, so that two
 * deliveries of the same webhook never both spend the work — and so the
 * order name the claim recorded is the one the message is written with.
 */
async function deliver(opts: {
  orderId: string | number;
  kind: OrderEventKind;
  email?: string | null;
  orderName?: string | null;
  build: (orderName: string) => OrderEmail;
}): Promise<Sent> {
  if (!supabaseConfigured()) return { sent: false, reason: "supabase not configured" };
  if (!emailConfigured()) return { sent: false, reason: "RESEND_API_KEY not set" };

  const orderId = String(opts.orderId);
  const prior = await priorFor(orderId);

  const address = (opts.email ?? prior?.email ?? "").trim().toLowerCase();
  if (!address) return { sent: false, reason: "no email address for this order" };

  const orderName = orderLabel(opts.orderName ?? prior?.order_name ?? undefined, orderId);
  if (!(await claim(orderId, opts.kind, address, orderName))) {
    return { sent: false, reason: "already notified" };
  }

  const { subject, html } = opts.build(orderName);
  try {
    await sendEmail(address, subject, html);
  } catch (err) {
    // Give the claim back so Shopify's retry gets another go — a send that
    // failed and a send that happened must not look the same to the lock.
    await release(orderId, opts.kind);
    console.error(`[email-order-notify] ${opts.kind} ${orderId} failed`, err);
    return { sent: false, reason: "Resend refused the send" };
  }
  return { sent: true };
}

export async function emailOrderPaid(opts: {
  order: {
    id: string | number;
    name?: string;
    email?: string;
    current_total_price?: string;
    total_price?: string;
    line_items?: { title?: string; quantity?: number }[];
  };
  points: number;
  balance: number | null;
}): Promise<Sent> {
  const total = parseFloat(opts.order.current_total_price ?? opts.order.total_price ?? "0");
  return deliver({
    orderId: opts.order.id,
    kind: "paid",
    email: opts.order.email ?? null,
    orderName: opts.order.name,
    build: (orderName) =>
      orderPaidEmail({
        orderId: opts.order.id,
        orderName,
        total,
        items: opts.order.line_items ?? [],
        points: opts.points,
        balance: opts.balance,
      }),
  });
}

export async function emailOrderShipped(opts: {
  orderId: string | number;
  orderName?: string;
  email?: string | null;
  fulfillment: { tracking_company?: string; tracking_number?: string; tracking_urls?: string[] };
  items?: { title?: string; quantity?: number }[];
}): Promise<Sent> {
  return deliver({
    orderId: opts.orderId,
    kind: "shipped",
    email: opts.email,
    orderName: opts.orderName,
    build: (orderName) =>
      orderShippedEmail({
        orderId: opts.orderId,
        orderName,
        fulfillment: opts.fulfillment,
        items: opts.items,
      }),
  });
}

export async function emailOrderDelivered(opts: {
  orderId: string | number;
  orderName?: string;
  email?: string | null;
}): Promise<Sent> {
  return deliver({
    orderId: opts.orderId,
    kind: "delivered",
    email: opts.email,
    orderName: opts.orderName,
    build: (orderName) => orderDeliveredEmail({ orderId: opts.orderId, orderName }),
  });
}

export async function emailOrderRefunded(opts: {
  orderId: string | number;
  orderName?: string;
  email?: string | null;
  amount: number;
  pointsReversed: number;
}): Promise<Sent> {
  // A restock or a paperwork-only refund moves no money; there is nothing to
  // tell the customer, and a "฿0 คืนเงินสำเร็จ" email would only worry them.
  if (opts.amount <= 0) return { sent: false, reason: "refund moved no money" };

  return deliver({
    orderId: opts.orderId,
    kind: "refunded",
    email: opts.email,
    orderName: opts.orderName,
    build: (orderName) =>
      orderRefundedEmail({
        orderId: opts.orderId,
        orderName,
        amount: opts.amount,
        pointsReversed: opts.pointsReversed,
      }),
  });
}

export async function emailOrderCancelled(opts: {
  orderId: string | number;
  orderName?: string;
  email?: string | null;
  reason?: string | null;
  pointsReversed?: number;
  refunded?: boolean;
}): Promise<Sent> {
  return deliver({
    orderId: opts.orderId,
    kind: "cancelled",
    email: opts.email,
    orderName: opts.orderName,
    build: (orderName) =>
      orderCancelledEmail({
        orderId: opts.orderId,
        orderName,
        reason: opts.reason,
        pointsReversed: opts.pointsReversed,
        refunded: opts.refunded,
      }),
  });
}

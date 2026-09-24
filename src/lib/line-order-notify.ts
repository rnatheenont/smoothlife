import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { pushLineMessages } from "@/lib/line-push";
import {
  orderCardMessage,
  baht,
  itemLines,
  orderLink,
  pointsLink,
  type OrderCard,
  type CardRow,
} from "@/lib/line-order-cards";

// Telling the customer what happened to their order, in the app they already
// have open.
//
// Everything here is best-effort and deliberately unable to break the webhook
// that calls it: a customer with no LINE identity, an unset token, a push LINE
// refuses — each returns a reason and nothing else. Points must still be
// credited and referrals still advanced when a notification cannot be sent.

type Kind = "paid" | "shipped" | "delivered" | "refunded";

/** The LINE userId for a site account, or null if they never signed in with LINE. */
async function lineUserIdFor(userId: string): Promise<string | null> {
  const [row] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${pgValue(userId)}&provider=eq.line&select=provider_uid&limit=1`
  ).catch((): { provider_uid: string }[] => []);
  return row?.provider_uid ?? null;
}

/** The site account behind an order's email — the same match the points credit uses. */
async function userIdByEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const rows = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=user_id&limit=1`
  ).catch((): { user_id: string }[] => []);
  return rows[0]?.user_id ?? null;
}

/**
 * Claims the right to send this notification, or says it is already sent.
 *
 * Shopify redelivers webhooks on any hiccup, and fulfillments/update fires
 * again on every courier scan — "your parcel arrived" three times is the kind
 * of thing that makes people mute an account. The insert is the lock: whoever
 * gets the row back sends, everyone else stops here.
 */
async function claim(orderId: string, kind: Kind, lineUserId: string, orderName: string): Promise<boolean> {
  const rows = await supabaseRest<{ id: string }[]>("line_order_notifications?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ id: `${orderId}:${kind}`, line_user_id: lineUserId, kind, order_name: orderName }),
  }).catch((): { id: string }[] => []);
  return rows.length > 0;
}

/**
 * What an earlier notification for this order already worked out.
 *
 * Two things arrive incomplete later in an order's life: a fulfillment or
 * refund webhook carries no customer email, and neither carries the "#1042"
 * the customer knows the order by. The card sent when they paid knew both, so
 * the rest of the order's messages borrow them from it rather than going back
 * to Shopify — or, worse, showing a raw database id.
 */
async function priorFor(orderId: string): Promise<{ line_user_id: string; order_name: string | null } | null> {
  const [row] = await supabaseRest<{ line_user_id: string; order_name: string | null }[]>(
    `line_order_notifications?id=like.${encodeURIComponent(`${orderId}:*`)}` +
      `&select=line_user_id,order_name&order=sent_at.asc&limit=1`
  ).catch((): { line_user_id: string; order_name: string | null }[] => []);
  return row ?? null;
}

/** Undoes a claim whose push never arrived, so Shopify's retry can try again. */
async function release(orderId: string, kind: Kind) {
  await supabaseRest(`line_order_notifications?id=eq.${pgValue(`${orderId}:${kind}`)}`, {
    method: "DELETE",
    returning: false,
  }).catch(() => {});
}

async function send(opts: {
  orderId: string | number;
  kind: Kind;
  userId?: string | null;
  email?: string | null;
  orderName?: string;
  card: Omit<OrderCard, "orderName">;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!supabaseConfigured()) return { sent: false, reason: "supabase not configured" };
  const orderId = String(opts.orderId);
  const prior = await priorFor(orderId);

  const userId = opts.userId ?? (await userIdByEmail(opts.email));
  const lineUserId = (userId ? await lineUserIdFor(userId) : null) ?? prior?.line_user_id ?? null;
  if (!lineUserId) return { sent: false, reason: "no LINE identity for this order" };

  const orderName = orderLabel(opts.orderName ?? prior?.order_name ?? undefined, orderId);
  if (!(await claim(orderId, opts.kind, lineUserId, orderName))) {
    return { sent: false, reason: "already notified" };
  }

  const ok = await pushLineMessages(lineUserId, [
    orderCardMessage({ ...opts.card, orderName, tapUri: opts.card.tapUri ?? orderLink(orderId) }),
  ]);
  if (!ok) {
    await release(orderId, opts.kind);
    return { sent: false, reason: "LINE refused the push (blocked, or quota spent)" };
  }
  return { sent: true };
}

/** "#1001.1" on a fulfillment is still order #1001 to the customer. */
function orderLabel(name: string | undefined | null, fallbackId: string | number) {
  const clean = (name ?? "").split(".")[0].trim();
  return clean || `#${fallbackId}`;
}

function trackingOf(fulfillment: { tracking_company?: string; tracking_number?: string; tracking_urls?: string[]; tracking_url?: string }) {
  const url = fulfillment.tracking_urls?.[0] || fulfillment.tracking_url || null;
  return { company: fulfillment.tracking_company || null, number: fulfillment.tracking_number || null, url };
}

/** Payment went through: what they bought, what it cost, and the points it earned. */
export async function notifyOrderPaid(opts: {
  order: { id: string | number; name?: string; email?: string; current_total_price?: string; total_price?: string; line_items?: { title?: string; quantity?: number }[] };
  userId: string;
  points: number;
  balance: number | null;
}) {
  const total = parseFloat(opts.order.current_total_price ?? opts.order.total_price ?? "0");
  const rows: CardRow[] = [{ label: "ยอดรวม", value: baht(total), strong: true }];
  if (opts.points > 0) {
    rows.push({ label: "แต้มที่ได้รับ", value: `+${opts.points.toLocaleString("th-TH")} แต้ม`, strong: true });
    if (opts.balance !== null) {
      rows.push({ label: "แต้มสะสมทั้งหมด", value: `${opts.balance.toLocaleString("th-TH")} แต้ม` });
    }
  }

  return send({
    orderId: opts.order.id,
    kind: "paid",
    userId: opts.userId,
    orderName: opts.order.name,
    card: {
      emoji: "✅",
      title: "ชำระเงินสำเร็จ",
      subtitle: "ขอบคุณที่สั่งซื้อกับ Smooth Life ค่ะ กำลังเตรียมจัดส่งให้นะคะ",
      rows,
      items: itemLines(opts.order.line_items ?? []),
      button: { label: "ดูคำสั่งซื้อ", uri: orderLink(opts.order.id) },
      secondaryButton: opts.points > 0 ? { label: "ดูแต้มสะสม", uri: pointsLink() } : undefined,
    },
  });
}

/** Handed to the courier — with the tracking number if Shopify has one. */
export async function notifyOrderShipped(opts: {
  orderId: string | number;
  orderName?: string;
  email?: string | null;
  userId?: string | null;
  fulfillment: { tracking_company?: string; tracking_number?: string; tracking_urls?: string[] };
  items?: { title?: string; quantity?: number }[];
}) {
  const tracking = trackingOf(opts.fulfillment);
  const rows: CardRow[] = [
    ...(tracking.company ? [{ label: "ขนส่ง", value: tracking.company }] : []),
    ...(tracking.number ? [{ label: "เลขพัสดุ", value: tracking.number, strong: true }] : []),
  ];

  return send({
    orderId: opts.orderId,
    kind: "shipped",
    userId: opts.userId ?? null,
    email: opts.email,
    orderName: opts.orderName,
    card: {
      emoji: "🚚",
      title: "พัสดุออกเดินทางแล้ว",
      subtitle: tracking.number ? "กดปุ่มด้านล่างเพื่อติดตามพัสดุได้เลยค่ะ" : "ทางร้านส่งพัสดุให้ขนส่งเรียบร้อยแล้วค่ะ",
      rows,
      items: itemLines(opts.items ?? []),
      // Tracking wins the primary button when there is one — it is the thing
      // they opened the message for — and the order stays one tap away on the
      // card itself and on the second button.
      button: tracking.url
        ? { label: "ติดตามพัสดุ", uri: tracking.url }
        : { label: "ดูคำสั่งซื้อ", uri: orderLink(opts.orderId) },
      secondaryButton: tracking.url ? { label: "ดูคำสั่งซื้อ", uri: orderLink(opts.orderId) } : undefined,
    },
  });
}

/** The courier says it arrived. */
export async function notifyOrderDelivered(opts: {
  orderId: string | number;
  orderName?: string;
  email?: string | null;
  userId?: string | null;
}) {
  return send({
    orderId: opts.orderId,
    kind: "delivered",
    userId: opts.userId ?? null,
    email: opts.email,
    orderName: opts.orderName,
    card: {
      emoji: "📦",
      title: "จัดส่งสำเร็จแล้ว",
      subtitle: "ได้รับของเรียบร้อยไหมคะ ถ้ามีอะไรไม่ตรงหรือสงสัย ทักมาในแชทนี้ได้เลยค่ะ",
      rows: [],
      button: { label: "ดูคำสั่งซื้อ", uri: orderLink(opts.orderId) },
    },
  });
}

/** Money went back — and, honestly, the points that came with it. */
export async function notifyOrderRefunded(opts: {
  orderId: string | number;
  orderName?: string;
  userId?: string | null;
  amount: number;
  pointsReversed: number;
}) {
  // A restock or a paperwork-only refund moves no money; there is nothing to
  // tell the customer, and a "฿0 คืนเงินสำเร็จ" card would only worry them.
  if (opts.amount <= 0) return { sent: false, reason: "refund moved no money" };

  const rows: CardRow[] = [{ label: "ยอดคืนเงิน", value: baht(opts.amount), strong: true, color: "#0E9F6E" }];
  if (opts.pointsReversed > 0) {
    rows.push({ label: "แต้มที่ถูกหักคืน", value: `-${opts.pointsReversed.toLocaleString("th-TH")} แต้ม`, strong: false, color: "#6B7280" });
  }

  return send({
    orderId: opts.orderId,
    kind: "refunded",
    userId: opts.userId,
    orderName: opts.orderName,
    card: {
      emoji: "💸",
      title: "คืนเงินสำเร็จ",
      subtitle: "เงินจะเข้าบัญชีตามรอบของธนาคารหรือผู้ให้บริการบัตร ปกติ 3–14 วันทำการค่ะ",
      rows,
      button: { label: "ดูคำสั่งซื้อ", uri: orderLink(opts.orderId) },
    },
  });
}

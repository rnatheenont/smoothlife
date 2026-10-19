import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { markReferralDelivered } from "@/lib/referral-cron";
import {
  notifyOrderShipped,
  notifyOrderDelivered,
  notifyOrderRefunded,
  notifyOrderCancelled,
// One call per event, fanned out to LINE and email — see order-notify.ts for
// why the route no longer talks to either channel directly.
} from "@/lib/order-notify";
import { settleFlashSaleShopifyOrder } from "@/lib/flash-sale-shopify";
// Shared with the 2C2P checkout webhook, which has to run the same work for
// orders Shopify never raises an orders/paid event for — see order-paid.ts.
import { handleOrdersPaid } from "@/lib/order-paid";

// Shopify webhook endpoint — configure in Shopify Admin (or via
// webhookSubscriptionCreate) to POST here for topics: orders/paid,
// orders/fulfilled (needed for the referral programme's delivery step —
// not yet subscribed as of this writing, see loyalty-program-plan.md),
// orders/cancelled, refunds/create, fulfillments/update, products/create,
// products/update, products/delete, inventory_levels/update,
// customers/delete.
//
// Five of those also tell the customer what just happened to their order —
// paid, shipped, delivered, refunded, cancelled — on LINE and by email at
// once (see lib/order-notify, which fans one call out to both).
// Those notifications are best-effort by design: they must never be able to
// stop points being credited or a referral advancing. Verifies
// the HMAC signature so only Shopify (holding SHOPIFY_WEBHOOK_SECRET)
// can trigger point changes, rebuilds, or account updates.

// The product catalogue (src/data/products.generated.ts) is only ever
// written by scripts/fetch-products.js during `next build` — see
// src/app/api/cron/refresh-catalogue/route.ts for why a fresh build is the
// only way to refresh it. That route already covers a once-a-day refresh;
// this triggers the same Deploy Hook immediately when a product actually
// changes on Shopify, so edits show up in minutes instead of up to 24h.
const REBUILD_DEBOUNCE_MS = 10 * 60 * 1000; // coalesce bursts of product edits into one rebuild

async function triggerCatalogueRebuildIfDue(): Promise<{ triggered: boolean; reason?: string }> {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) return { triggered: false, reason: "VERCEL_DEPLOY_HOOK_URL not configured" };

  const [state] = await supabaseRest<{ last_triggered_at: string | null }[]>(
    "catalogue_refresh_state?select=last_triggered_at&limit=1"
  );
  const lastTriggeredAt = state?.last_triggered_at ? new Date(state.last_triggered_at).getTime() : 0;
  if (Date.now() - lastTriggeredAt < REBUILD_DEBOUNCE_MS) {
    return { triggered: false, reason: "debounced — a rebuild already ran recently" };
  }

  const res = await fetch(hookUrl, { method: "POST" });
  if (!res.ok) return { triggered: false, reason: `deploy hook returned ${res.status}` };

  await supabaseRest("catalogue_refresh_state?id=eq.true", {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ last_triggered_at: new Date().toISOString() }),
  });
  return { triggered: true };
}

/**
 * Two secrets, because this store genuinely has two signers.
 *
 * Shopify signs a webhook with whatever created it: one made in Admin >
 * Settings > Notifications is signed with the store's webhook signing secret
 * (SHOPIFY_WEBHOOK_SECRET), while one registered through the Admin API is
 * signed with the **registering app's client secret**
 * (SHOPIFY_ADMIN_CLIENT_SECRET). The orders and customers topics were created
 * by hand; the catalogue ones (products/*, inventory_levels/update) come from
 * registerCatalogueWebhooks running under this app. Checking only the first
 * secret rejected every catalogue delivery — 600 of them in a day — so stock
 * and product edits silently stopped reaching the site while orders kept
 * working, which is what made it look like nothing was wrong.
 */
function verifyHmac(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const secrets = [process.env.SHOPIFY_WEBHOOK_SECRET, process.env.SHOPIFY_ADMIN_CLIENT_SECRET].filter(
    (s): s is string => Boolean(s)
  );
  const received = Buffer.from(header);
  return secrets.some((secret) => {
    const digest = Buffer.from(createHmac("sha256", secret).update(rawBody, "utf8").digest("base64"));
    return digest.length === received.length && timingSafeEqual(digest, received);
  });
}

// Fires on the "orders/fulfilled" topic — not yet subscribed in Shopify as
// of this writing (see the comment at the top of this file), so this is a
// fast-path optimization, not the only way delivery gets detected —
// advanceOrderPlacedReferrals in @/lib/referral-cron polls for it too.
async function handleOrdersFulfilled(order: any) {
  // The tracking number lives on the fulfillment, and the newest one is the
  // shipment this webhook is about — an order split across two parcels sends
  // this twice, each with its own number.
  const fulfillment = (order.fulfillments || []).slice(-1)[0] ?? {};
  const notified = await notifyOrderShipped({
    orderId: order.id,
    orderName: order.name,
    email: order.email || order.customer?.email,
    fulfillment,
    items: fulfillment.line_items ?? order.line_items ?? [],
  });

  const result = await markReferralDelivered(String(order.id));
  if (!result) return { skipped: "no order_placed referral for this order", notified };
  return { referralId: result.referralId, status: "delivered", notified };
}

/**
 * Courier scans, of which only one matters to the customer.
 *
 * fulfillments/update fires on every scan — label printed, in transit, out for
 * delivery — and the one worth interrupting someone's day for is the parcel
 * actually arriving. Everything else is noise they can see in the tracking
 * link they already have.
 */
async function handleFulfillmentUpdate(fulfillment: any) {
  if (fulfillment.shipment_status !== "delivered") {
    return { skipped: `shipment_status=${fulfillment.shipment_status ?? "none"}` };
  }
  return {
    notified: await notifyOrderDelivered({
      orderId: fulfillment.order_id,
      orderName: fulfillment.name,
      email: fulfillment.email,
    }),
  };
}

async function handleOrdersCancelled(order: any) {
  // Whether Shopify gave the money back as part of cancelling. It decides
  // which sentence the card uses, and the difference matters: telling someone
  // their refund is on its way when no refund exists is a promise this code
  // cannot keep.
  const refunded = ["refunded", "partially_refunded", "voided"].includes(
    String(order.financial_status ?? "")
  );
  const notifyCustomer = (userId: string | null, pointsReversed: number) =>
    notifyOrderCancelled({
      orderId: order.id,
      orderName: order.name,
      userId,
      email: order.email ?? null,
      reason: order.cancel_reason ?? null,
      pointsReversed,
      refunded,
    });

  const original = await supabaseRest<{ user_id: string; delta: number }[]>(
    `points_ledger?shopify_event_id=eq.${encodeURIComponent(String(order.id))}&reason=eq.order_paid&select=user_id,delta`
  );
  const row = original[0];
  if (!row) {
    // A guest order, or one from before the ledger. No points to take back,
    // but the order is just as cancelled — and if they were told when they
    // paid, they are owed this too. notifyOrderCancelled finds them through
    // that first card, the same way the refund path does.
    return {
      skipped: "no prior order_paid credit to reverse",
      notified: await notifyCustomer(null, 0),
    };
  }

  await supabaseRest(`points_ledger?on_conflict=shopify_event_id`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: row.user_id,
      delta: -row.delta,
      reason: "order_cancelled",
      shopify_order_id: String(order.id),
      shopify_event_id: `${order.id}:cancel`,
      metadata: { reversed_delta: row.delta },
    }),
  });

  // The points_ledger insert above has a negative delta, so it doesn't hit
  // notify_on_points_earned's `delta > 0` trigger — the cancellation itself
  // is still worth telling the customer about, so notify directly here.
  await supabaseRest("notifications", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: row.user_id,
      type: "order_cancelled",
      title: "คำสั่งซื้อของคุณถูกยกเลิก",
      body: order.name ? `ออเดอร์ ${order.name}` : undefined,
      link: "/account/orders",
      metadata: { shopify_order_id: String(order.id) },
    }),
  });

  return { reversed: row.delta, notified: await notifyCustomer(row.user_id, row.delta) };
}

// Any refund on a referred friend's tracked order voids the referrer's
// reward — matches the plan's explicit edge case. Runs independent of the
// points-ledger reversal below, since a referral can exist even when no
// ledger row does. If the reward already released (a real coupon code
// already exists), we can't safely auto-revoke it — this is logged for
// manual follow-up rather than silently doing nothing.
async function handleReferralRefundVoid(orderId: string | number) {
  const [row] = await supabaseRest<{ id: string; status: string }[]>(
    `referrals?referred_order_id=eq.${encodeURIComponent(String(orderId))}&select=id,status&limit=1`
  );
  if (!row) return { skipped: "no referral tracks this order" };
  if (row.status === "reward_released") {
    console.error(
      `[referral] order ${orderId} refunded after reward already released (referral ${row.id}) — needs manual review/clawback`
    );
    return { flaggedForManualReview: row.id };
  }
  if (row.status === "void" || row.status === "expired") return { skipped: "already terminal" };
  await supabaseRest(`referrals?id=eq.${row.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "void" }),
  });
  return { referralId: row.id, status: "void" };
}

async function handleRefundsCreate(refund: any) {
  const orderId = refund.order_id;
  const referralVoidResult = await handleReferralRefundVoid(orderId);
  const original = await supabaseRest<
    { user_id: string; metadata: { pointsPerBaht?: number; multiplier?: number } | null }[]
  >(`points_ledger?shopify_order_id=eq.${encodeURIComponent(String(orderId))}&reason=eq.order_paid&select=user_id,metadata&limit=1`);
  const refundedAmount = (refund.transactions || []).reduce(
    (sum: number, t: any) => sum + (parseFloat(t.amount) || 0),
    0
  );

  const row = original[0];
  if (!row) {
    // No points to reverse — a guest order, or one from before the ledger.
    // The money still moved, and if they were told when they paid they should
    // be told now: notifyOrderRefunded finds them through that first card.
    const notified = await notifyOrderRefunded({
      orderId,
      amount: refundedAmount,
      pointsReversed: 0,
    });
    return { skipped: "no prior order_paid credit for this order", referralVoidResult, notified };
  }
  // Reverse at whatever rate the original order was actually credited at —
  // pointsPerBaht for orders credited after the uniform-rate fix, or the
  // legacy tier multiplier (÷100 rate) for older ledger rows, so historical
  // orders don't get silently mis-reversed when the global rate changes.
  const pointsToReverse =
    row.metadata?.pointsPerBaht !== undefined
      ? Math.floor(refundedAmount * row.metadata.pointsPerBaht)
      : Math.floor((refundedAmount * (row.metadata?.multiplier ?? 1)) / 100);
  if (pointsToReverse <= 0) {
    const notified = await notifyOrderRefunded({
      orderId,
      userId: row.user_id,
      amount: refundedAmount,
      pointsReversed: 0,
    });
    return { skipped: "refund amount too small to affect points", referralVoidResult, notified };
  }

  await supabaseRest(`points_ledger?on_conflict=shopify_event_id`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: row.user_id,
      delta: -pointsToReverse,
      reason: "refund",
      shopify_order_id: String(orderId),
      shopify_event_id: String(refund.id),
      metadata: { refundedAmount, pointsPerBaht: row.metadata?.pointsPerBaht ?? null },
    }),
  });
  const notified = await notifyOrderRefunded({
    orderId,
    userId: row.user_id,
    amount: refundedAmount,
    pointsReversed: pointsToReverse,
  });
  return { reversed: pointsToReverse, referralVoidResult, notified };
}

// If a Shopify customer is deleted, we release that email/phone so the same
// person can register fresh with it again — but we deliberately don't touch
// anything else. The old account, its points, and its order-history link
// stay exactly as they are; it just becomes unreachable by that email/phone
// (still reachable via any other linked identity, e.g. LINE/Google/Apple).
// shopify_customer_id can be stored either as a bare numeric id (from the
// orders/paid webhook) or a full GID (from the GraphQL Admin API paths), so
// match both forms.
async function handleCustomersDelete(customer: any) {
  const numericId = String(customer.id);
  const gid = `gid://shopify/Customer/${numericId}`;
  const matches = await supabaseRest<{ id: string }[]>(
    `users?shopify_customer_id=in.(${numericId},${encodeURIComponent(gid)})&select=id`
  );
  if (!matches.length) return { skipped: "no member linked to this Shopify customer" };

  await supabaseRest(`users?shopify_customer_id=in.(${numericId},${encodeURIComponent(gid)})`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ shopify_customer_id: null }),
  });

  const userIds = matches.map((m) => m.id);
  const releasedIdentities = await supabaseRest<{ user_id: string; provider: string; provider_uid: string }[]>(
    `auth_identities?user_id=in.(${userIds.join(",")})&provider=in.(email,phone_otp)&select=user_id,provider,provider_uid`
  );
  if (releasedIdentities.length) {
    await supabaseRest(`auth_identities?user_id=in.(${userIds.join(",")})&provider=in.(email,phone_otp)`, {
      method: "DELETE",
      returning: false,
    });
  }

  return { clearedShopifyLink: userIds, releasedIdentities };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyHmac(rawBody, hmacHeader)) {
    // Say who was turned away. A rejected webhook is otherwise a silent 401 in
    // the access log, and the cause is never the code: it is that the sender
    // signs with a different secret than SHOPIFY_WEBHOOK_SECRET — a second
    // store, or webhooks registered by an app whose client secret signs them
    // instead of the store's webhook signing secret. Shop and topic are the
    // two facts that tell those apart, and neither is sensitive.
    console.error(
      "[webhooks/shopify] rejected: shop=%s topic=%s webhookId=%s hmac=%s",
      req.headers.get("x-shopify-shop-domain") ?? "-",
      req.headers.get("x-shopify-topic") ?? "-",
      req.headers.get("x-shopify-webhook-id") ?? "-",
      hmacHeader ? "present" : "missing"
    );
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    // Ack so Shopify doesn't retry forever, but do nothing.
    return NextResponse.json({ skipped: "supabase not configured" }, { status: 200 });
  }

  const topic = req.headers.get("x-shopify-topic");
  const payload = JSON.parse(rawBody);

  try {
    let result: unknown;
    switch (topic) {
      case "orders/paid": {
        // The flash-sale reservation is settled first and on its own, because
        // handleOrdersPaid gives up early when the buyer's email matches no
        // account here — and a paid slot has to be marked paid either way.
        // For an ordinary shop order this does nothing at all.
        const flashSale = await settleFlashSaleShopifyOrder(payload).catch((err) => {
          console.error("[shopify webhook] flash-sale settlement failed", err);
          return { error: String(err) };
        });
        result = { flashSale, points: await handleOrdersPaid(payload, req.url) };
        break;
      }
      case "orders/fulfilled":
        result = await handleOrdersFulfilled(payload);
        break;
      case "fulfillments/update":
        result = await handleFulfillmentUpdate(payload);
        break;
      case "orders/cancelled":
        result = await handleOrdersCancelled(payload);
        break;
      case "refunds/create":
        result = await handleRefundsCreate(payload);
        break;
      case "products/create":
      case "products/update":
      case "products/delete":
      case "inventory_levels/update":
        // A pure stock change doesn't reliably fire products/update in
        // modern Shopify (inventory is a separate resource from the
        // product) — subscribed separately so stock staleness gets the
        // same near-instant rebuild as product edits, not just the daily
        // cron. Payload isn't parsed; any inventory change is reason
        // enough to refresh the whole catalogue.
        result = await triggerCatalogueRebuildIfDue();
        break;
      case "customers/delete":
        result = await handleCustomersDelete(payload);
        break;
      default:
        result = { skipped: `unhandled topic: ${topic}` };
    }
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    // Return 200 with an error note rather than 500 — a 500 makes Shopify
    // retry the same webhook repeatedly, which won't help if the failure is
    // a bug rather than a transient error. Failures are still visible in
    // Vercel logs for follow-up.
    console.error("[shopify webhook]", topic, err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}

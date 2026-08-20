import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { pointsForOrder } from "@/lib/points";
import { products } from "@/data/products";
import { subscriptionPlans } from "@/data/subscriptions";

// Shopify webhook endpoint — configure in Shopify Admin (or via
// webhookSubscriptionCreate) to POST here for topics: orders/paid,
// orders/cancelled, refunds/create, products/create, products/update,
// products/delete, customers/delete. Verifies the HMAC signature so only
// Shopify (holding SHOPIFY_WEBHOOK_SECRET) can trigger point changes,
// rebuilds, or account updates.

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

function verifyHmac(rawBody: string, header: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function findUserIdByEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const rows = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=user_id`
  );
  return rows[0]?.user_id ?? null;
}

async function currentBalance(userId: string): Promise<number> {
  const rows = await supabaseRest<{ balance: number }[]>(`points_balance?user_id=eq.${userId}&select=balance`);
  return rows[0]?.balance ?? 0;
}

async function handleOrdersPaid(order: any) {
  const email: string | undefined = order.email || order.customer?.email;
  const userId = await findUserIdByEmail(email);
  if (!userId) return { skipped: "no matching member for order email" };

  const subtotal = parseFloat(order.current_subtotal_price ?? order.subtotal_price ?? "0");
  const balance = await currentBalance(userId);
  const { points, multiplier, tier } = pointsForOrder(subtotal, balance);

  await supabaseRest(`points_ledger?on_conflict=shopify_event_id`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      delta: points,
      reason: "order_paid",
      shopify_order_id: String(order.id),
      shopify_event_id: String(order.id),
      metadata: { subtotal, multiplier, tier, currency: order.currency },
    }),
  });

  if (order.customer?.id) {
    await supabaseRest(`users?id=eq.${userId}&shopify_customer_id=is.null`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_customer_id: String(order.customer.id) }),
    });
  }

  const subscriptionResult = await handleSubscriptionOrder(order, userId);
  return { credited: points, userId, subscriptionResult };
}

// Auto-detects and tracks a "Subscribe & Save" purchase (product detail
// page's subscribe panel) so /account/subscriptions can show it and the
// reminder cron can nudge the customer near renewal — this app has no real
// recurring-billing backend, so "subscribed" here means "we'll track and
// remind", not "we'll auto-charge". Detection is a heuristic since the
// SUB3/SUB6/SUB12 codes are whole-order percent-off codes with no
// per-line-item scoping in the Shopify discount itself: only a line item
// whose quantity exactly matches the plan's month count is treated as the
// subscribed item (this is exactly what the subscribe panel always adds),
// so an unrelated item that happens to share the same quantity by
// coincidence is the one false-positive case this can't fully rule out.
const SUBSCRIPTION_CODES = new Set(subscriptionPlans.map((p) => p.code));

async function handleSubscriptionOrder(order: any, userId: string) {
  const codes: string[] = (order.discount_codes || []).map((d: any) => String(d.code).toUpperCase());
  const matchedCode = codes.find((c) => SUBSCRIPTION_CODES.has(c));
  if (!matchedCode) return { skipped: "no subscription discount code on this order" };
  const plan = subscriptionPlans.find((p) => p.code === matchedCode);
  if (!plan) return { skipped: "matched code not found in current plan list" };

  const purchasedAt = new Date(order.created_at ?? Date.now());
  const nextRenewal = new Date(purchasedAt);
  nextRenewal.setMonth(nextRenewal.getMonth() + plan.months);

  let tracked = 0;
  for (const li of order.line_items || []) {
    if (!li.variant_id || li.quantity !== plan.months) continue;
    const variantGid = `gid://shopify/ProductVariant/${li.variant_id}`;
    const product = products.find((p) => p.variants.some((v) => v.variantId === variantGid));
    if (!product) continue;

    await supabaseRest(`subscription_preferences?on_conflict=shopify_order_id,variant_id`, {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: userId,
        shopify_order_id: String(order.id),
        shopify_order_name: order.name ?? null,
        product_slug: product.slug,
        product_name: li.title || product.name,
        variant_id: variantGid,
        plan_months: plan.months,
        plan_code: plan.code,
        price_per_cycle: parseFloat(li.price ?? "0"),
        purchased_at: purchasedAt.toISOString(),
        next_renewal_at: nextRenewal.toISOString(),
      }),
    });
    tracked++;
  }
  return { tracked, plan: matchedCode };
}

async function handleOrdersCancelled(order: any) {
  const original = await supabaseRest<{ user_id: string; delta: number }[]>(
    `points_ledger?shopify_event_id=eq.${encodeURIComponent(String(order.id))}&reason=eq.order_paid&select=user_id,delta`
  );
  const row = original[0];
  if (!row) return { skipped: "no prior order_paid credit to reverse" };

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

  return { reversed: row.delta };
}

async function handleRefundsCreate(refund: any) {
  const orderId = refund.order_id;
  const original = await supabaseRest<{ user_id: string; metadata: { multiplier?: number } | null }[]>(
    `points_ledger?shopify_order_id=eq.${encodeURIComponent(String(orderId))}&reason=eq.order_paid&select=user_id,metadata&limit=1`
  );
  const row = original[0];
  if (!row) return { skipped: "no prior order_paid credit for this order" };

  const refundedAmount = (refund.transactions || []).reduce(
    (sum: number, t: any) => sum + (parseFloat(t.amount) || 0),
    0
  );
  const multiplier = row.metadata?.multiplier ?? 1;
  const pointsToReverse = Math.floor((refundedAmount * multiplier) / 100);
  if (pointsToReverse <= 0) return { skipped: "refund amount too small to affect points" };

  await supabaseRest(`points_ledger?on_conflict=shopify_event_id`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: row.user_id,
      delta: -pointsToReverse,
      reason: "refund",
      shopify_order_id: String(orderId),
      shopify_event_id: String(refund.id),
      metadata: { refundedAmount, multiplier },
    }),
  });
  return { reversed: pointsToReverse };
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
      case "orders/paid":
        result = await handleOrdersPaid(payload);
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

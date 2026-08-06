import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { pointsForOrder } from "@/lib/points";

// Shopify webhook endpoint — configure in Shopify Admin (or via
// webhookSubscriptionCreate) to POST here for topics: orders/paid,
// orders/cancelled, refunds/create. Verifies the HMAC signature so only
// Shopify (holding SHOPIFY_WEBHOOK_SECRET) can trigger point changes.

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
  return { credited: points, userId };
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

import { supabaseRest } from "@/lib/supabase-server";
import { pointsForOrder } from "@/lib/points";
import { POINTS_PER_BAHT } from "@/data/coupons";
import { products } from "@/data/products";
import { subscriptionPlans } from "@/data/subscriptions";
import { emailConfigured, sendEmail, guestOrderInviteEmailHtml } from "@/lib/email";
import { notifyOrderPaid } from "@/lib/order-notify";
import { recalculateLoyaltyForUser } from "@/lib/loyalty-cron";

// Everything that should happen because an order has been paid for: points
// credited, a guest invited to claim the order, a referral advanced, a
// subscription noted, and the customer told.
//
// It lives here rather than inside the Shopify webhook because two different
// events mean "this order is paid" and only one of them is a Shopify webhook.
// A card taken through the shop's own checkout is written to Shopify by
// createPaidShopifyOrder as an order that is *already* paid, and Shopify
// emits orders/paid on a payment transition — there is no transition, so no
// event. While this code sat in the webhook file, every one of those
// customers silently got nothing: no points, no referral, no message.
// Confirmed against live data before moving it (two ฿990 card payments on
// 16 October 2026, neither with an order_paid row in points_ledger).
//
// Safe to call twice for the same order, which is what makes calling it from
// both places workable: the points insert is keyed on shopify_event_id with
// ignore-duplicates, the guest invite on shopify_order_id, the subscription
// row on (order, variant), the referral update only matches a row still in
// the 'registered' state, and the notification has its own dedupe table. If
// Shopify is ever made to emit orders/paid for these orders too, the second
// run changes nothing.

async function findUserIdByEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const rows = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=user_id`
  );
  return rows[0]?.user_id ?? null;
}

// Guest checkout (no Smoothlife account) still places a real Shopify order
// with a real email — invite them to claim it into an account instead of
// silently losing the loyalty signup that every logged-in order gets for
// free. Deduped on shopify_order_id so a webhook retry never double-sends.
async function inviteGuestToSignUp(order: any, email: string, requestUrl: string) {
  if (!emailConfigured()) return { skipped: "email not configured" };
  const inserted = await supabaseRest<{ id: string }[]>("guest_checkout_invites?on_conflict=shopify_order_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ shopify_order_id: String(order.id), email: email.trim().toLowerCase() }),
  });
  if (inserted.length === 0) return { skipped: "invite already sent for this order" };

  const signupUrl = new URL("/account/login?returnTo=%2Faccount", requestUrl).toString();
  await sendEmail(
    email,
    "สมัครสมาชิกเพื่อรับคะแนนสะสม - Smoothlife.com",
    guestOrderInviteEmailHtml(order.name || `#${order.order_number ?? order.id}`, signupUrl)
  );
  return { invited: true };
}

/**
 * Product names for the message, looked up when the payload has none.
 *
 * A Shopify webhook body carries the title on every line item. The payload
 * the 2C2P checkout builds does not — the cart only ever stored a variant id,
 * a quantity and a price — and without this the customer's receipt would list
 * their order as "สินค้า x1".
 */
function withTitles(lineItems: any[]): { title?: string; quantity?: number }[] {
  return (lineItems || []).map((li: any) => {
    if (li.title) return { title: li.title, quantity: li.quantity };
    const gid = `gid://shopify/ProductVariant/${li.variant_id}`;
    const product = products.find((pr) => pr.variants.some((v) => v.variantId === gid));
    return { title: product?.name, quantity: li.quantity };
  });
}

export async function handleOrdersPaid(order: any, requestUrl: string) {
  const email: string | undefined = order.email || order.customer?.email;
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    if (!email) return { skipped: "no matching member and no order email" };
    const inviteResult = await inviteGuestToSignUp(order, email, requestUrl);
    return { skipped: "no matching member for order email", inviteResult };
  }

  const subtotal = parseFloat(order.current_subtotal_price ?? order.subtotal_price ?? "0");
  const { points, tier } = await pointsForOrder(subtotal, userId);

  await supabaseRest(`points_ledger?on_conflict=shopify_event_id`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      delta: points,
      reason: "order_paid",
      shopify_order_id: String(order.id),
      shopify_event_id: String(order.id),
      metadata: { subtotal, pointsPerBaht: POINTS_PER_BAHT, tier, currency: order.currency },
    }),
  });

  if (order.customer?.id) {
    await supabaseRest(`users?id=eq.${userId}&shopify_customer_id=is.null`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_customer_id: String(order.customer.id) }),
    });
  }

  // The points above land at once; the twelve-month spend behind the tier
  // card did not. That number is maintained by the nightly pass, which
  // reviews 25 accounts against 463 — a rotation of about nineteen days. A
  // customer reviewed three minutes before their order paid therefore saw
  // "฿0, 0 orders" next to the points that order had just earned them, and
  // kept seeing it for a fortnight (found 30 Oct 2026, order #4700).
  //
  // Awaited rather than fired and forgotten like the other callers: those
  // run inside a request a person is waiting on, where the work can finish
  // after the response. This is a webhook, and the function returning is
  // the end of the invocation — a promise left running is a promise that
  // may never resolve. It never throws, and tomorrow's cron still covers
  // whatever it misses.
  //
  // After the backfill above, never before: it reads the Shopify customer
  // id to know whose orders to add up.
  const loyalty = await recalculateLoyaltyForUser(userId);

  const subscriptionResult = await handleSubscriptionOrder(order, userId);
  const referralResult = await handleReferralOrderPlaced(userId, order, subtotal);

  // Read back rather than adding to a number we had: the balance on the card
  // is the one the account page will show them when they tap through, and the
  // ledger is the only thing that knows about expiries and earlier spending.
  const [balanceRow] = await supabaseRest<{ balance: number }[]>(
    `points_balance?user_id=eq.${userId}&select=balance&limit=1`
  ).catch((): { balance: number }[] => []);
  const notified = await notifyOrderPaid({
    order: { ...order, line_items: withTitles(order.line_items) },
    userId,
    points,
    balance: balanceRow?.balance ?? null,
  });

  return { credited: points, userId, loyalty, subscriptionResult, referralResult, notified };
}

// A referred friend's FIRST paid order moves their referral row from
// 'registered' to 'order_placed'. The status=eq.registered + is.null filters
// make this naturally idempotent — a Shopify webhook retry, or this
// customer's second/third order, just won't match a row anymore.
async function handleReferralOrderPlaced(userId: string, order: any, subtotal: number) {
  const [row] = await supabaseRest<{ id: string }[]>(
    `referrals?referred_user_id=eq.${userId}&status=eq.registered&referred_order_id=is.null&select=id&limit=1`
  );
  if (!row) return { skipped: "no pending referral for this customer" };
  await supabaseRest(`referrals?id=eq.${row.id}&status=eq.registered`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ referred_order_id: String(order.id), order_amount: subtotal, status: "order_placed" }),
  });
  return { referralId: row.id, status: "order_placed" };
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

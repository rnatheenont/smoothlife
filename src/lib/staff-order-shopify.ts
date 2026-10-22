import { pgValue, supabaseRest } from "@/lib/supabase-server";
import {
  createPaidShopifyOrder,
  createShopifyCustomer,
  findShopifyCustomerByEmail,
  shopifyAdminConfigured,
} from "@/lib/shopify-admin";
import { ORDER_COLUMNS, type StaffOrder } from "@/lib/staff-sale";

// Turning a paid staff order into a Shopify order.
//
// Here rather than inside the webhook because it is run from two places and
// has to behave identically in both: once when 2C2P confirms the payment,
// and again when an admin presses retry on one that failed. A second copy
// of this in the admin route is a second copy that drifts — and the thing
// that would drift is the tag every revenue report filters on.
//
// Never creates a second order for the same staff order: the caller is
// expected to hold one (the webhook claims the payment row; the admin route
// checks shopify_sync_status), and the guard below is the backstop.

export type StaffSyncResult = {
  ok: boolean;
  shopifyOrderId: string | null;
  note: string | null;
};

type TxRow = {
  cart_token: string;
  user_id: string | null;
  contact_email: string | null;
  tran_ref: string | null;
  invoice_no: string;
  shipping_address: Record<string, string | undefined> | null;
};

/**
 * Finds, or makes, the Shopify customer this order belongs to.
 *
 * Without one the purchase never appears in the employee's own order
 * history — which is the whole point of putting it in Shopify rather than
 * only in our own tables.
 */
async function resolveCustomerId(userId: string | null, email: string): Promise<string | null> {
  if (userId) {
    const users = await supabaseRest<{ shopify_customer_id: string | null }[]>(
      `users?id=eq.${pgValue(userId)}&select=shopify_customer_id&limit=1`,
    ).catch(() => []);
    const existing = users?.[0]?.shopify_customer_id;
    if (existing) return existing;
  }

  const found = await findShopifyCustomerByEmail(email);
  const id = found?.id ?? (await createShopifyCustomer({ email }))?.id ?? null;

  // Back-filled so the next order skips both lookups, and so the rest of the
  // account — order history, the group's other stores — finds them too.
  if (id && userId) {
    await supabaseRest(`users?id=eq.${pgValue(userId)}&shopify_customer_id=is.null`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_customer_id: id }),
    }).catch(() => {});
  }
  return id;
}

export async function syncStaffOrderToShopify(orderId: string): Promise<StaffSyncResult> {
  const orders = await supabaseRest<StaffOrder[]>(
    `staff_orders?id=eq.${pgValue(orderId)}&select=${ORDER_COLUMNS}&limit=1`,
  ).catch(() => []);
  const order = orders?.[0];
  if (!order) return { ok: false, shopifyOrderId: null, note: "staff order not found" };
  if (order.shopify_order_id) {
    // Already there. Said as success, because the caller's question is "is
    // this order in Shopify", and it is.
    return { ok: true, shopifyOrderId: order.shopify_order_id, note: null };
  }
  if (order.status !== "paid") {
    return { ok: false, shopifyOrderId: null, note: `order is ${order.status}, not paid` };
  }
  if (!shopifyAdminConfigured()) {
    return { ok: false, shopifyOrderId: null, note: "Shopify Admin not configured" };
  }

  const txs = await supabaseRest<TxRow[]>(
    `payment_transactions?staff_order_id=eq.${pgValue(orderId)}&select=cart_token,user_id,contact_email,tran_ref,invoice_no,shipping_address&order=created_at.desc&limit=1`,
  ).catch(() => []);
  const tx = txs?.[0];
  if (!tx) return { ok: false, shopifyOrderId: null, note: "no payment row for this order" };

  const address = tx.shipping_address ?? {};
  try {
    const created = await createPaidShopifyOrder({
      customerId: (await resolveCustomerId(tx.user_id, tx.contact_email ?? order.staff_email)) ?? undefined,
      email: tx.contact_email ?? order.staff_email,
      // The prices the round recorded when the cart was created, not
      // today's price list — an admin re-pricing an item must not change
      // what a paid order says it cost.
      lineItems: (order.lines ?? []).map((l) => ({
        variantId: l.variant_id,
        quantity: Number(l.qty),
        price: Number(l.staff_price),
      })),
      currencyCode: "THB",
      shippingAddress: {
        firstName: address.firstName,
        lastName: address.lastName,
        address1: address.address1 ?? "",
        city: address.city ?? "",
        province: address.province,
        zip: address.zip ?? "",
        countryCode: address.countryCode ?? "TH",
        phone: address.phone,
      },
      note: `Staff Sale ${order.round_id} · 2C2P ${tx.invoice_no}`,
      tranRef: tx.tran_ref ?? tx.invoice_no,
      // What the profile badge, the admin filter and every revenue report
      // read. An order sold below retail with no tag saying why is an order
      // nobody can account for later.
      tags: ["staff-purchase", `staff-round:${order.round_id}`],
    });

    await supabaseRest(`staff_orders?id=eq.${pgValue(orderId)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_order_id: created.id, shopify_sync_status: "synced" }),
    });
    await supabaseRest(`payment_transactions?staff_order_id=eq.${pgValue(orderId)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_order_id: created.id }),
    }).catch(() => {});

    return { ok: true, shopifyOrderId: created.id, note: null };
  } catch (err) {
    console.error("[staff-order-shopify] createPaidShopifyOrder failed", orderId, err);
    const note = err instanceof Error ? err.message.slice(0, 200) : "Shopify order failed";
    await supabaseRest(`staff_orders?id=eq.${pgValue(orderId)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_sync_status: "failed", note }),
    }).catch(() => {});
    return { ok: false, shopifyOrderId: null, note };
  }
}

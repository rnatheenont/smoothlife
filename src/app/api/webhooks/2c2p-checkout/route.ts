import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { twoC2PConfigured, verifyPaymentCallback } from "@/lib/2c2p";
import { createPaidShopifyOrder } from "@/lib/shopify-admin";
import { confirmStock, releaseStock } from "@/lib/stock-reservation";
import { notifyOrderPaid } from "@/lib/order-notify";

type TransactionRow = {
  id: string;
  cart_token: string;
  status: string;
  amount: number;
  currency_code: string;
  line_items: { variantId: string; quantity: number; price: number }[] | null;
  discount_code: string | null;
  discount_amount: number | null;
  contact_email: string | null;
  shipping_address: {
    firstName?: string;
    lastName?: string;
    address1: string;
    city: string;
    postalCode: string;
    countryCode: string;
    state?: string;
    phone?: string;
  };
};

// backendReturnUrl for one-time custom-checkout purchases (see
// src/app/api/checkout/init/route.ts) — the cart-purchase counterpart to
// src/app/api/webhooks/2c2p/route.ts, which handles subscription cycles.
// On success: confirm the stock reservation and create the real Shopify
// order. On failure/expiry: release the reservation back to the pool.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !twoC2PConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 200 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.payload) return NextResponse.json({ ok: false, error: "missing payload" }, { status: 200 });

  let callback;
  try {
    callback = verifyPaymentCallback(body.payload);
  } catch (err) {
    console.error("[webhooks/2c2p-checkout] signature verification failed", err);
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 200 });
  }

  const [transaction] = await supabaseRest<TransactionRow[]>(
    `payment_transactions?invoice_no=eq.${callback.invoiceNo}&select=id,cart_token,status,amount,currency_code,line_items,contact_email,shipping_address,discount_code,discount_amount`
  );
  if (!transaction) {
    console.error("[webhooks/2c2p-checkout] no transaction matches invoice", callback.invoiceNo);
    return NextResponse.json({ ok: false, error: "unknown transaction" }, { status: 200 });
  }

  // 2C2P may call the backend return URL more than once for the same
  // invoice (retries) — only ever act on it once.
  if (transaction.status !== "pending") {
    return NextResponse.json({ ok: true, result: "already processed" });
  }

  const success = callback.respCode === "0000";

  if (!success) {
    await releaseStock(transaction.cart_token);
    await supabaseRest(`payment_transactions?id=eq.${transaction.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "failed", tran_ref: callback.tranRef, resp_code: callback.respCode, resp_desc: callback.respDesc }),
    });
    return NextResponse.json({ ok: true, result: "charge_failed" });
  }

  await confirmStock(transaction.cart_token);
  await supabaseRest(`payment_transactions?id=eq.${transaction.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "success",
      tran_ref: callback.tranRef,
      resp_code: callback.respCode,
      resp_desc: callback.respDesc,
      confirmed_at: new Date().toISOString(),
    }),
  });

  // Which name this payment is known by, and whether Shopify ever heard of
  // it. Declared out here so the notification below can be sent either way.
  let shopifyOrderId: string | null = null;
  let shopifyOrderName: string | null = null;

  try {
    const addr = transaction.shipping_address;
    const order = await createPaidShopifyOrder({
      email: transaction.contact_email ?? undefined,
      lineItems: transaction.line_items ?? [],
      currencyCode: transaction.currency_code,
      shippingAddress: {
        firstName: addr.firstName,
        lastName: addr.lastName,
        address1: addr.address1,
        city: addr.city,
        province: addr.state,
        zip: addr.postalCode,
        countryCode: addr.countryCode,
        phone: addr.phone,
      },
      note: "สั่งซื้อผ่านหน้าชำระเงินของเว็บไซต์ (2C2P)",
      tranRef: callback.tranRef,
      discount: transaction.discount_code
        ? { code: transaction.discount_code, amount: transaction.discount_amount ?? 0 }
        : null,
    });
    shopifyOrderId = String(order.id).replace("gid://shopify/Order/", "");
    // "#1042" — what the customer will see everywhere else. Without it the
    // message would name the order by its raw Shopify id.
    shopifyOrderName = order.name ?? null;
    await supabaseRest(`payment_transactions?id=eq.${transaction.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_order_id: order.id }),
    });
  } catch (err) {
    // Payment already succeeded and stock is confirmed — never let a
    // Shopify-side failure make us report the charge as failed. Logged for
    // manual follow-up via the admin dashboard's "charged but no order"
    // pattern (see /admin/subscriptions-overview for the existing version
    // of that view; extending it to cover cart purchases is a follow-up).
    console.error("[webhooks/2c2p-checkout] charge succeeded but Shopify order creation failed", err);
  }

  // Tell the customer the money went through.
  //
  // This has to happen here rather than only in the Shopify webhook, because
  // for these orders that webhook never fires. createPaidShopifyOrder writes
  // an order that is already paid through the Admin API, and Shopify emits
  // orders/paid on a payment *transition* — there is no transition, so no
  // event, so nothing downstream of it runs. Verified against live data: the
  // two card payments taken through this route on 16 October produced no
  // order_paid row in points_ledger at all, while flash-sale orders, which
  // reach Shopify by a different road, produced one every time.
  //
  // Keyed on the Shopify order id when there is one, so that if that webhook
  // is ever made to fire for these orders the dedupe table stops the second
  // message rather than the customer getting two. Falling back to the invoice
  // number keeps the one case that matters most covered: the charge went
  // through but the order could not be written, which is exactly when silence
  // is worst.
  //
  // points: 0 is the truth and not a placeholder — no points are credited on
  // this path today, for the same missing-webhook reason, and an email
  // promising points that were never given is worse than one that stays quiet
  // about them.
  try {
    await notifyOrderPaid({
      order: {
        id: shopifyOrderId ?? callback.invoiceNo,
        name: shopifyOrderName ?? (shopifyOrderId ? undefined : callback.invoiceNo),
        email: transaction.contact_email ?? undefined,
        total_price: String(transaction.amount ?? 0),
        line_items: transaction.line_items ?? [],
      },
      points: 0,
      balance: null,
    });
  } catch (err) {
    // The charge is already recorded. A notifier is never allowed to turn a
    // successful payment into a failed callback.
    console.error("[webhooks/2c2p-checkout] paid notification failed", err);
  }

  return NextResponse.json({ ok: true, result: "charge_succeeded" });
}

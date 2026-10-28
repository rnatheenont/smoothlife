import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { twoC2PConfigured, verifyPaymentCallback } from "@/lib/2c2p";
import { confirmStock, releaseStock } from "@/lib/stock-reservation";
import { syncStaffOrderToShopify } from "@/lib/staff-order-shopify";
import { staffRpc, type RpcResult } from "@/lib/staff-sale-rpc";

// backendReturnUrl for staff payments. Its own webhook, not a branch in the
// customer one, for the same reason /api/staff/checkout is its own route:
// the customer path hands a paid order to handleOrdersPaid, which awards
// loyalty points, pays referral commission and emails the buyer their new
// points balance. None of that belongs on a purchase at cost.
//
// Always answers 200. A non-200 makes 2C2P retry, and every retry is another
// run at an order that has already been created.

type TxRow = {
  id: string;
  cart_token: string;
  user_id: string | null;
  amount: number;
  status: string;
  staff_order_id: string | null;
  contact_email: string | null;
  shipping_address: Record<string, unknown> | null;
  line_items: { variantId: string; quantity: number; price: number }[] | null;
};

const TX_COLUMNS =
  "id,cart_token,user_id,amount,status,staff_order_id,contact_email,shipping_address,line_items";

export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !twoC2PConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 200 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.payload) {
    return NextResponse.json({ ok: false, error: "missing payload" }, { status: 200 });
  }

  let callback;
  try {
    callback = verifyPaymentCallback(body.payload);
  } catch (err) {
    console.error("[webhooks/2c2p-staff] signature verification failed", err);
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 200 });
  }

  const success = callback.respCode === "0000";

  // The claim, and the whole reason this is a PATCH and not a SELECT.
  //
  // 2C2P delivers the same callback more than once, sometimes at the same
  // moment. Reading the row, checking it is pending and then writing it
  // leaves a window in which two deliveries both pass the check — and each
  // then creates a Shopify order. Asking the database to move the row from
  // `pending` to `processing` and hand back what it moved means exactly one
  // delivery is holding it.
  const claimed = await supabaseRest<TxRow[]>(
    `payment_transactions?invoice_no=eq.${pgValue(callback.invoiceNo)}&status=eq.pending&staff_order_id=not.is.null&select=${TX_COLUMNS}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "processing",
        tran_ref: callback.tranRef,
        resp_code: callback.respCode,
        resp_desc: callback.respDesc,
      }),
    },
  ).catch((err) => {
    console.error("[webhooks/2c2p-staff] claim failed", err);
    return [] as TxRow[];
  });

  const tx = claimed?.[0];
  if (!tx) {
    // Either a repeat of something already handled, or an invoice that is
    // not a staff payment. Both are "nothing to do", and both have to be a
    // 200 or 2C2P keeps asking.
    console.warn("[webhooks/2c2p-staff] nothing pending for invoice", callback.invoiceNo);
    return NextResponse.json({ ok: true, skipped: "not pending" }, { status: 200 });
  }

  const orderId = tx.staff_order_id!;

  if (!success) {
    await releaseStock(tx.cart_token).catch(() => {});
    await staffRpc("staff_cancel_order", { p_order: orderId, p_user: null }).catch(() => {});
    await supabaseRest(`payment_transactions?id=eq.${pgValue(tx.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "failed" }),
    }).catch(() => {});
    return NextResponse.json({ ok: true, result: "declined" }, { status: 200 });
  }

  // The allowance becomes spent, the quota becomes sold. Refuses a late
  // payment whose room is gone and flags it for a refund instead — the one
  // case the flash sale got wrong before.
  const confirmed = await staffRpc<RpcResult>("staff_confirm_payment", {
    p_reference: callback.invoiceNo,
    p_amount: callback.amount,
  });

  if (!confirmed?.ok) {
    // The money is real either way, so the transaction is recorded as
    // success. What failed is the entitlement, and that is a human's to
    // resolve from the console's "ต้องจัดการ" list.
    console.error("[webhooks/2c2p-staff] confirm refused", {
      invoice: callback.invoiceNo,
      reason: confirmed?.reason,
    });
    await supabaseRest(`payment_transactions?id=eq.${pgValue(tx.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        status: "success",
        confirmed_at: new Date().toISOString(),
        resp_desc: `${callback.respDesc} · staff_confirm_payment: ${confirmed?.reason ?? "failed"}`,
      }),
    }).catch(() => {});

    // The belt to the RPC's braces. staff_confirm_payment flags the order
    // itself on every refusal it knows of, but a reason added to it later —
    // or one raised before it ever reads the order, as 'unknown_reference'
    // is — would reach the console as nothing at all, because that list is
    // filtered on this flag. So it is set again here from the transaction's
    // own order id, which is known even when the reference is not.
    //
    // Not swallowed like the calls around it: every other failure in this
    // branch costs a retry, and this one costs a payment nobody is looking
    // for. If it ever fires, the log line is the last trace there is.
    const flagged = await supabaseRest(`staff_orders?id=eq.${pgValue(orderId)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ needs_refund: true }),
    }).then(
      () => true,
      (err) => {
        console.error("[webhooks/2c2p-staff] could not flag for refund", {
          invoice: callback.invoiceNo,
          orderId,
          err,
        });
        return false;
      },
    );

    await releaseStock(tx.cart_token).catch(() => {});
    return NextResponse.json(
      { ok: true, result: confirmed?.reason ?? "confirm failed", flagged },
      { status: 200 },
    );
  }

  await confirmStock(tx.cart_token).catch(() => {});

  // From here the money has moved and the entitlement is settled. Anything
  // that fails below leaves shopify_sync_status = 'failed' and a row in the
  // console's "ต้องจัดการ" list to retry, never an unpaid order.
  const sync = await syncStaffOrderToShopify(orderId);

  await supabaseRest(`payment_transactions?id=eq.${pgValue(tx.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "success",
      confirmed_at: new Date().toISOString(),
      shopify_order_id: sync.shopifyOrderId,
    }),
  }).catch(() => {});

  // Deliberately no handleOrdersPaid, no points, no referral commission, no
  // attribution and no `purchase` analytics event. Shopify sends its own
  // receipt (sendReceipt: true in createPaidShopifyOrder), which is the
  // confirmation the plan asked for.
  return NextResponse.json(
    { ok: true, result: sync.ok ? "synced" : "failed", shopifyOrderId: sync.shopifyOrderId },
    { status: 200 },
  );
}

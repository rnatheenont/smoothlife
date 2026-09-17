import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { twoC2PConfigured, verifyPaymentCallback } from "@/lib/2c2p";
import { confirmFlashSalePayment, LATE_PAYMENT_NOTE } from "@/lib/flash-sale";
import { createFlashSaleOrder, FLASH_SALE_TX_COLUMNS, type FlashSaleTransaction } from "@/lib/flash-sale-orders";

// backendReturnUrl for flash-sale payments (see /api/flash-sale/[id]/pay).
// The only place a flash-sale reservation becomes paid (plan §5):
//   1. verify the JWT signature before reading anything in it
//   2. match the invoice to a pending flash-sale transaction, amount included
//   3. fs_confirm_payment — atomic, refuses a late or repeated confirmation
//   4. only then create the Shopify order, outside that database step
// A charge that arrives after its reservation is gone is recorded as paid and
// flagged for a refund; it never takes a slot that went to someone else.
// Always answers 200 so 2C2P doesn't retry a request we've already handled.

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
    console.error("[webhooks/2c2p-flash-sale] signature verification failed", err);
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 200 });
  }

  const [tx] = await supabaseRest<(FlashSaleTransaction & { status: string })[]>(
    `payment_transactions?invoice_no=eq.${pgValue(callback.invoiceNo)}&flash_sale_entry_id=not.is.null&select=${FLASH_SALE_TX_COLUMNS},status`
  );
  if (!tx) {
    console.error("[webhooks/2c2p-flash-sale] no flash-sale transaction for invoice", callback.invoiceNo);
    return NextResponse.json({ ok: false, error: "unknown transaction" }, { status: 200 });
  }
  if (tx.status !== "pending") return NextResponse.json({ ok: true, result: "already processed" });

  const txFilter = `payment_transactions?id=eq.${pgValue(tx.id)}&status=eq.pending`;

  if (callback.respCode !== "0000") {
    await supabaseRest(txFilter, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "failed", tran_ref: callback.tranRef, resp_code: callback.respCode, resp_desc: callback.respDesc }),
    });
    // The shopper may try again within their remaining time.
    await supabaseRest(`flash_sale_queue?id=eq.${pgValue(tx.flash_sale_entry_id)}&status=eq.reserved`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ payment_pending_until: null }),
    });
    return NextResponse.json({ ok: true, result: "charge_failed" });
  }

  const amountMatches = Math.abs(Number(callback.amount) - Number(tx.amount)) < 0.005;
  const paidEntry = amountMatches ? await confirmFlashSalePayment(tx.flash_sale_entry_id, callback.invoiceNo) : null;

  await supabaseRest(txFilter, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "success",
      tran_ref: callback.tranRef,
      resp_code: callback.respCode,
      resp_desc: callback.respDesc,
      confirmed_at: new Date().toISOString(),
      refund_note: paidEntry
        ? null
        : amountMatches
          ? LATE_PAYMENT_NOTE
          : `FLASH_SALE_AMOUNT_MISMATCH: 2C2P ${callback.amount} ≠ ${tx.amount} ต้องตรวจสอบ`,
    }),
  });

  if (!paidEntry) {
    console.error("[webhooks/2c2p-flash-sale] charge not matched to a live reservation — flagged for refund", callback.invoiceNo);
    return NextResponse.json({ ok: true, result: "flagged_for_refund" });
  }

  await createFlashSaleOrder({ ...tx, tran_ref: callback.tranRef });
  return NextResponse.json({ ok: true, result: "charge_succeeded" });
}

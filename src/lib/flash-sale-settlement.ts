// What a flash-sale charge means for the reservation behind it.
//
// This was the tail of the 2C2P webhook and nothing else could reach it, which
// mattered the day 2C2P never called: the transaction sat `pending` with no
// tranRef, the money was gone or not and we had no way to ask, and the customer
// had neither their slot nor their money back. The same steps now run from the
// webhook and from the admin reconciliation that asks 2C2P directly
// (/api/admin/checkout-transactions/reconcile), so an answer that arrives late
// settles the reservation exactly as a prompt one would have.
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { confirmFlashSalePayment, LATE_PAYMENT_NOTE } from "@/lib/flash-sale";
import { createFlashSaleOrder, type FlashSaleTransaction } from "@/lib/flash-sale-orders";

/** The fields a charge outcome carries, from a callback or an inquiry alike. */
export type ChargeOutcome = {
  invoiceNo: string;
  amount: number;
  respCode: string;
  respDesc: string;
  tranRef?: string;
};

export type SettlementResult =
  | "already_processed"
  | "charge_failed"
  | "flagged_for_refund"
  | "charge_succeeded";

/**
 * Applies a charge outcome to a flash-sale transaction that is still pending.
 * Never throws for an ordinary outcome; the caller decides what to report.
 */
export async function settleFlashSaleCharge(
  tx: FlashSaleTransaction & { status: string },
  outcome: ChargeOutcome
): Promise<SettlementResult> {
  if (tx.status !== "pending") return "already_processed";
  const txFilter = `payment_transactions?id=eq.${pgValue(tx.id)}&status=eq.pending`;

  if (outcome.respCode !== "0000") {
    await supabaseRest(txFilter, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        status: "failed",
        tran_ref: outcome.tranRef,
        resp_code: outcome.respCode,
        resp_desc: outcome.respDesc,
      }),
    });
    // The shopper may try again within their remaining time.
    await supabaseRest(`flash_sale_queue?id=eq.${pgValue(tx.flash_sale_entry_id)}&status=eq.reserved`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ payment_pending_until: null }),
    });
    return "charge_failed";
  }

  const amountMatches = Math.abs(Number(outcome.amount) - Number(tx.amount)) < 0.005;
  const paidEntry = amountMatches ? await confirmFlashSalePayment(tx.flash_sale_entry_id, outcome.invoiceNo) : null;

  await supabaseRest(txFilter, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "success",
      tran_ref: outcome.tranRef,
      resp_code: outcome.respCode,
      resp_desc: outcome.respDesc,
      confirmed_at: new Date().toISOString(),
      refund_note: paidEntry
        ? null
        : amountMatches
          ? LATE_PAYMENT_NOTE
          : `FLASH_SALE_AMOUNT_MISMATCH: 2C2P ${outcome.amount} ≠ ${tx.amount} ต้องตรวจสอบ`,
    }),
  });

  if (!paidEntry) {
    console.error("[flash-sale] charge not matched to a live reservation — flagged for refund", outcome.invoiceNo);
    return "flagged_for_refund";
  }

  await createFlashSaleOrder({ ...tx, tran_ref: outcome.tranRef ?? tx.tran_ref });
  return "charge_succeeded";
}

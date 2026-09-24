import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { twoC2PConfigured, verifyPaymentCallback } from "@/lib/2c2p";
import { FLASH_SALE_TX_COLUMNS, type FlashSaleTransaction } from "@/lib/flash-sale-orders";
import { settleFlashSaleCharge } from "@/lib/flash-sale-settlement";

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
  // What happens to the reservation lives in flash-sale-settlement.ts, because
  // the admin reconciliation needs the identical steps when 2C2P never calls
  // here at all and the answer has to be fetched instead.
  const result = await settleFlashSaleCharge(tx, callback);
  return NextResponse.json({ ok: true, result });
}

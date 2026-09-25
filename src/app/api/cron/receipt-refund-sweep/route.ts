import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server";
import { orderPaymentByGid } from "@/lib/shopify-admin";
import { revokeEntriesForTransaction } from "@/lib/receipt-revoke";

// Refunds that happen where we are not looking.
//
// Our own admin revokes entries the moment it records a refund, but a refund
// is just as likely to be made in Shopify or in the 2C2P portal by somebody
// who has never seen this campaign. Nothing tells us. So once a day every
// live entry's order is re-read from Shopify, and the ones whose money has
// gone back lose the entries it bought.
//
// The check is one batched query for every order at once, so a campaign with
// a thousand entries is a handful of requests, not a thousand.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  payment_transaction_id: string | null;
  payment_transactions: { shopify_order_id: string | null } | null;
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rows = await supabaseRest<Row[]>(
    `receipt_campaign_entries?status=in.(pending_review,approved)&payment_transaction_id=not.is.null` +
      `&select=id,payment_transaction_id,payment_transactions(shopify_order_id)&limit=1000`
  ).catch(() => [] as Row[]);

  const byGid = new Map<string, string>();
  for (const row of rows) {
    const gid = row.payment_transactions?.shopify_order_id;
    if (gid && row.payment_transaction_id) byGid.set(gid, row.payment_transaction_id);
  }
  if (!byGid.size) return NextResponse.json({ ok: true, checked: 0, revoked: 0 });

  const payments = await orderPaymentByGid([...byGid.keys()]);

  let revoked = 0;
  let heldPrize = 0;
  for (const [gid, transactionId] of byGid) {
    const status = payments.get(gid)?.financialStatus;
    // Only a status we actually read counts against anyone. Shopify not
    // answering is not evidence that a refund happened, and taking entries
    // away on a failed request is the one mistake here with no undo.
    if (!status || status === "PAID" || status === "PARTIALLY_PAID") continue;
    if (status !== "REFUNDED" && status !== "PARTIALLY_REFUNDED" && status !== "VOIDED") continue;

    const result = await revokeEntriesForTransaction(
      transactionId,
      status === "PARTIALLY_REFUNDED"
        ? "คำสั่งซื้อนี้มีการคืนเงินบางส่วน"
        : status === "VOIDED"
          ? "คำสั่งซื้อนี้ถูกยกเลิก"
          : "คำสั่งซื้อนี้ได้รับการคืนเงินเรียบร้อยแล้ว"
    ).catch(() => ({ revoked: 0, heldPrize: false }));

    revoked += result.revoked;
    if (result.heldPrize) heldPrize += 1;

    if (result.revoked) {
      await supabaseRest("admin_audit_log", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          action: "receipt.revoke.sweep",
          target: transactionId,
          detail: { shopifyOrderId: gid, financialStatus: status, entries: result.revoked, heldPrize: result.heldPrize },
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, checked: byGid.size, revoked, heldPrize });
}

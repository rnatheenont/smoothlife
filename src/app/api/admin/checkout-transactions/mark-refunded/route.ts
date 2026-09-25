import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { refundShopifyOrder } from "@/lib/shopify-admin";
import { revokeEntriesForTransaction } from "@/lib/receipt-revoke";

// "I have already sent the money back" — recorded in both books at once.
//
// The 2C2P refund API is refused from this app's servers (see 2c2p.ts: the
// 401 is an IIS page, not the application, so the request is being turned away
// before the envelope is read), which leaves the merchant portal as the place
// a refund actually happens. What used to follow was three systems to update
// by hand, in an order that matters: refund in the portal, record it here,
// then refund again in Shopify so the order stops saying "paid".
//
// The last step is now this one's job. Shopify cannot move money on these
// orders anyway — the sale carries the gateway name "2C2P" as a label, not a
// connection — so its refund was always bookkeeping, and doing it here keeps
// it from being done first by mistake, which would mark an order refunded
// while the customer was still waiting for their money.
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const transactionId = body?.transactionId;
  if (!transactionId) return NextResponse.json({ ok: false, error: "missing transactionId" }, { status: 400 });

  const [tx] = await supabaseRest<{ id: string; amount: number; shopify_order_id: string | null }[]>(
    `payment_transactions?id=eq.${pgValue(transactionId)}&select=id,amount,shopify_order_id&limit=1`
  );
  if (!tx) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });

  // Shopify first: if it refuses, nothing here claims the refund happened.
  // A failure is reported rather than swallowed, but it does not stop the
  // record — the money has already gone back, and that is the fact.
  let shopify: { ok: true } | { ok: false; error: string } | null = null;
  if (tx.shopify_order_id) {
    shopify = await refundShopifyOrder({
      orderId: tx.shopify_order_id,
      amount: Number(tx.amount),
      note: body?.note ? String(body.note).slice(0, 200) : "คืนเงินผ่าน 2C2P portal",
    });
  }

  await supabaseRest(`payment_transactions?id=eq.${pgValue(transactionId)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_note: `บันทึกด้วยตนเอง${body?.note ? `: ${body.note}` : ""}`,
    }),
  });

  // The entries the refunded purchase bought go back with the money. Done
  // here rather than left to a nightly sweep because the customer is being
  // told about the refund now, and two messages a day apart about one event
  // is how a shop sounds when nobody is in charge of it.
  const revoked = await revokeEntriesForTransaction(
    transactionId,
    "คำสั่งซื้อนี้ได้รับการคืนเงินเรียบร้อยแล้ว"
  ).catch((err) => {
    console.error("[mark-refunded] revoke failed", err);
    return { revoked: 0, heldPrize: false };
  });

  return NextResponse.json({
    ok: true,
    revokedEntries: revoked.revoked,
    heldPrize: revoked.heldPrize,
    shopify: shopify?.ok ?? null,
    shopifyError: shopify && shopify.ok === false ? shopify.error : undefined,
  });
}

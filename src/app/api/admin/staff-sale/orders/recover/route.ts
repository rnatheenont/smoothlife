import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { inquireTransactionStatus, twoC2PConfigured } from "@/lib/2c2p";
import { confirmStock, releaseStock } from "@/lib/stock-reservation";
import { syncStaffOrderToShopify } from "@/lib/staff-order-shopify";
import { staffRpc, type RpcResult } from "@/lib/staff-sale-rpc";
import { auditStaffSale, badRequest, guard } from "@/lib/staff-sale-admin";

export const runtime = "nodejs";

// Finishes a staff order that was paid for and never completed.
//
// The webhook at /api/webhooks/2c2p-staff answers 200 whatever happens,
// because a non-200 makes 2C2P retry and every retry is another run at an
// order that already exists. The cost of that choice is that a delivery we
// mishandle is a delivery we never see again — which is exactly what
// happened on 28 Oct 2026: the claim PATCH wrote `processing`, a status the
// table's CHECK constraint did not allow, so fifteen staff payments in a row
// were charged by 2C2P and left sitting at "รอชำระ" until they expired.
//
// The constraint is fixed. This is the way back for an order that was
// already lost, and the way back for the next one, whatever the next cause
// turns out to be.
//
// It does not take the operator's word for the payment. 2C2P is asked
// directly, and the invoice, the response code and the amount all have to
// agree before a single row moves — otherwise this is a button that marks
// unpaid orders paid.

type TxRow = {
  id: string;
  cart_token: string;
  amount: number;
  status: string;
  staff_order_id: string | null;
};

export async function POST(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;
  if (!supabaseConfigured() || !twoC2PConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) return badRequest("ไม่พบออเดอร์ที่จะปิด");

  const orders = await supabaseRest<
    { id: string; status: string; payment_reference: string | null; subtotal_thb: number }[]
  >(
    `staff_orders?id=eq.${pgValue(orderId)}&select=id,status,payment_reference,subtotal_thb&limit=1`,
  );
  const order = orders?.[0];
  if (!order) return NextResponse.json({ ok: false, error: "ไม่พบออเดอร์นี้" }, { status: 404 });
  if (order.status !== "pending") {
    return badRequest(`ออเดอร์นี้สถานะ ${order.status} อยู่แล้ว — ปิดได้เฉพาะใบที่ยังรอชำระ`);
  }
  if (!order.payment_reference) return badRequest("ออเดอร์นี้ไม่มีเลขอ้างอิงการชำระเงิน");

  // Ask 2C2P, not the operator.
  let inquiry;
  try {
    inquiry = await inquireTransactionStatus(order.payment_reference);
  } catch (err) {
    console.error("[staff-sale/recover] inquiry failed", err);
    return NextResponse.json(
      { ok: false, error: "สอบถามสถานะจาก 2C2P ไม่สำเร็จ", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
  if (inquiry.respCode !== "0000") {
    return badRequest(
      `2C2P บอกว่ายังไม่ได้ชำระ (${inquiry.respCode} ${inquiry.respDesc}) — ใบนี้ปิดไม่ได้`,
    );
  }
  // The amount has to be the one we asked for. A mismatch is the flash
  // sale's late-refund bug wearing a different hat.
  if (Math.round(Number(inquiry.amount) * 100) !== Math.round(Number(order.subtotal_thb) * 100)) {
    return badRequest(
      `ยอดไม่ตรง — 2C2P ว่า ${inquiry.amount} แต่ออเดอร์ ${order.subtotal_thb} ใบนี้ต้องให้คนตรวจก่อน`,
    );
  }

  // The same claim the webhook makes, for the same reason: two people
  // pressing this at once must not both run the steps below.
  const claimed = await supabaseRest<TxRow[]>(
    `payment_transactions?staff_order_id=eq.${pgValue(orderId)}&status=eq.pending&select=id,cart_token,amount,status,staff_order_id`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "processing",
        tran_ref: inquiry.tranRef ?? null,
        resp_code: inquiry.respCode,
        resp_desc: inquiry.respDesc,
      }),
    },
  ).catch((err) => {
    console.error("[staff-sale/recover] claim failed", err);
    return [] as TxRow[];
  });
  const tx = claimed?.[0];
  if (!tx) return badRequest("ไม่มีรายการชำระเงินที่รออยู่สำหรับออเดอร์นี้ — อาจมีคนปิดไปแล้ว");

  const confirmed = await staffRpc<RpcResult>("staff_confirm_payment", {
    p_reference: order.payment_reference,
    p_amount: Number(inquiry.amount),
  });

  if (!confirmed?.ok) {
    // Same split as the webhook: the money is real, so the payment is
    // recorded as success. What failed is the entitlement, and that is a
    // person's to resolve.
    await supabaseRest(`payment_transactions?id=eq.${pgValue(tx.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        status: "success",
        confirmed_at: new Date().toISOString(),
        resp_desc: `${inquiry.respDesc} · staff_confirm_payment: ${confirmed?.reason ?? "failed"}`,
      }),
    }).catch(() => {});
    await releaseStock(tx.cart_token).catch(() => {});
    await auditStaffSale(req, "staff_sale.order_recover_refused", orderId, {
      reason: confirmed?.reason ?? "failed",
    });
    return NextResponse.json(
      { ok: false, error: `ยืนยันสิทธิ์ไม่ผ่าน: ${confirmed?.reason ?? "ไม่ทราบสาเหตุ"} — ต้องคืนเงินให้พนักงาน` },
      { status: 409 },
    );
  }

  await confirmStock(tx.cart_token).catch(() => {});
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

  await auditStaffSale(req, "staff_sale.order_recover", orderId, {
    invoice: order.payment_reference,
    tran_ref: inquiry.tranRef ?? null,
    amount: inquiry.amount,
    shopify_order_id: sync.shopifyOrderId,
    synced: sync.ok,
  });

  return NextResponse.json({
    ok: true,
    synced: sync.ok,
    shopifyOrderId: sync.shopifyOrderId,
  });
}

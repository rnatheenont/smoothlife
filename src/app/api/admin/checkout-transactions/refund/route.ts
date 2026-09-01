import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { refundTransaction, recurringMaintenanceConfigured } from "@/lib/2c2p";

// Calls 2C2P's real Refund API against a payment_transactions row (full or
// partial). Gated by recurringMaintenanceConfigured() same as
// cancelRecurringPlan/inquireRecurringPlan — needs the RSA key exchange
// through 2C2P's merchant portal, not just TWOC2P_MERCHANT_ID/SECRET_KEY.
// Until that's done this always fails cleanly with a clear error; the
// admin UI falls back to the bookkeeping-only mark-refunded route below.
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const transactionId = body?.transactionId;
  if (!transactionId) return NextResponse.json({ ok: false, error: "missing transactionId" }, { status: 400 });

  const [transaction] = await supabaseRest<{ id: string; invoice_no: string; amount: number; status: string }[]>(
    `payment_transactions?id=eq.${transactionId}&select=id,invoice_no,amount,status`
  );
  if (!transaction) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });
  if (transaction.status !== "success") {
    return NextResponse.json({ ok: false, error: "คืนเงินได้เฉพาะรายการที่ชำระสำเร็จแล้วเท่านั้น" }, { status: 400 });
  }

  const actionAmount = Number(body?.amount) > 0 ? Number(body.amount) : transaction.amount;
  if (actionAmount > transaction.amount) {
    return NextResponse.json({ ok: false, error: "ยอดคืนเงินเกินยอดที่ชำระไว้" }, { status: 400 });
  }

  if (!recurringMaintenanceConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่าคีย์สำหรับเรียก API คืนเงินของ 2C2P — ใช้ปุ่ม \"บันทึกว่าคืนเงินแล้ว\" แทนไปก่อน" },
      { status: 503 }
    );
  }

  try {
    const result = await refundTransaction(transaction.invoice_no, actionAmount);
    const isPending = result.status?.toUpperCase().includes("PENDING");
    const note = `2C2P: ${result.respDesc || result.respCode}${result.refundReferenceNo ? ` (ref: ${result.refundReferenceNo})` : ""} — ฿${actionAmount.toLocaleString()}`;

    await supabaseRest(`payment_transactions?id=eq.${transaction.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify(
        isPending
          ? { refund_note: `รอผลคืนเงินจาก 2C2P — ${note}` }
          : { status: "refunded", refunded_at: new Date().toISOString(), refund_note: note }
      ),
    });

    return NextResponse.json({ ok: true, pending: Boolean(isPending), result });
  } catch (err) {
    console.error("[admin/checkout-transactions/refund] 2C2P refund failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "เรียก API คืนเงินของ 2C2P ไม่สำเร็จ" },
      { status: 502 }
    );
  }
}

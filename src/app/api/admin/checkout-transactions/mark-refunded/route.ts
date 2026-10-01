import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { refundShopifyOrder } from "@/lib/shopify-admin";
import { revokeEntriesForTransaction } from "@/lib/receipt-revoke";
import { refundRouteFor } from "@/lib/refund-route";

// Closing the books on a refund. What this does depends on which checkout took
// the money (see refund-route.ts), because the two are not interchangeable:
//
//  * portal route (our 2C2P checkout) — the money has to have gone back through
//    the merchant portal first; the caller has to say so. All this does then is
//    record it here and refund the Shopify order so it stops saying "paid".
//    Shopify cannot move money on these orders, which is exactly why doing the
//    Shopify half first, by hand, left three customers unpaid under an order
//    marked refunded.
//
//  * shopify route (the flash-sale queue, paid through Shopify's own checkout) —
//    Shopify holds the real payment, so the refund here *is* the refund. If
//    Shopify refuses it, nothing is recorded: the customer still has not been
//    paid and the row must keep saying so.
//
// The caller sends the route it believes it is on and a mismatch is refused, so
// a page left open from before this split cannot act on the wrong assumption.
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const transactionId = body?.transactionId;
  if (!transactionId) return NextResponse.json({ ok: false, error: "missing transactionId" }, { status: 400 });

  const [tx] = await supabaseRest<
    { id: string; amount: number; shopify_order_id: string | null; tran_ref: string | null; status: string }[]
  >(
    `payment_transactions?id=eq.${pgValue(transactionId)}&select=id,amount,shopify_order_id,tran_ref,status&limit=1`
  );
  if (!tx) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });
  if (tx.status === "refunded") {
    return NextResponse.json({ ok: false, error: "รายการนี้บันทึกว่าคืนเงินแล้ว" }, { status: 400 });
  }

  const route = refundRouteFor(tx.tran_ref);
  if (body?.route && body.route !== route) {
    return NextResponse.json(
      { ok: false, error: "ข้อมูลหน้านี้ไม่ตรงกับช่องทางคืนเงินจริง — กดรีเฟรชแล้วลองอีกครั้ง", route },
      { status: 409 }
    );
  }
  // The portal is the only place money moves on this route, so there is nothing
  // to record until somebody has been there. The checkbox in the admin UI is
  // what sets this; refusing it here is what makes the checkbox mean something.
  if (route === "portal" && body?.portalRefunded !== true) {
    return NextResponse.json(
      { ok: false, error: "ยืนยันก่อนว่าคืนเงินใน 2C2P portal เรียบร้อยแล้ว" },
      { status: 400 }
    );
  }

  const shopify = tx.shopify_order_id
    ? await refundShopifyOrder({
        orderId: tx.shopify_order_id,
        amount: Number(tx.amount),
        note: body?.note
          ? String(body.note).slice(0, 200)
          : route === "portal"
            ? "คืนเงินผ่าน 2C2P portal"
            : "คืนเงินผ่านหน้าแอดมิน",
      })
    : null;

  // On the Shopify route this call *was* the refund. Recording it after a
  // failure would be the original bug with the systems swapped round.
  if (route === "shopify" && !shopify) {
    return NextResponse.json(
      { ok: false, error: "รายการนี้ยังไม่มีออเดอร์ Shopify จึงคืนเงินผ่าน Shopify ไม่ได้" },
      { status: 502 }
    );
  }
  if (route === "shopify" && shopify.ok === false) {
    return NextResponse.json(
      { ok: false, error: `Shopify คืนเงินไม่สำเร็จ — ยังไม่ได้คืนเงินให้ลูกค้า: ${shopify.error}` },
      { status: 502 }
    );
  }

  await supabaseRest(`payment_transactions?id=eq.${pgValue(transactionId)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_note:
        (route === "portal" ? "คืนเงินผ่าน 2C2P portal" : "คืนเงินผ่าน Shopify") +
        (body?.note ? `: ${body.note}` : ""),
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
    route,
    shopify: shopify?.ok ?? null,
    shopifyError: shopify && shopify.ok === false ? shopify.error : undefined,
  });
}

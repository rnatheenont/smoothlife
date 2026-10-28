import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { releaseStock } from "@/lib/stock-reservation";
import { reasonTh } from "@/lib/staff-sale";
import { staffRpc, type RpcResult } from "@/lib/staff-sale-rpc";

// An employee abandoning their own unpaid staff order.
//
// Worth a button rather than leaving it to the sweep: a cart held for
// thirty minutes is thirty minutes of somebody's own allowance they cannot
// spend, and of a quota nobody else can take.
//
// `p_user` is the session's id, and the RPC compares it to the order's
// owner — so the id in the request body cannot be somebody else's order.

export async function POST(req: NextRequest) {
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "ไม่พบคำสั่งซื้อ" }, { status: 400 });

  const res = await staffRpc<RpcResult>("staff_cancel_order", { p_order: id, p_user: userId });
  if (!res?.ok) {
    return NextResponse.json({ ok: false, error: reasonTh(res?.reason) }, { status: 409 });
  }

  // The allowance and the quota are back; the Shopify hold should go too.
  // After the RPC rather than before: if the cancel is refused, the hold
  // still belongs to a live order.
  //
  // The lookup is for the cart token and nothing else. Closing the payment
  // row used to be nested inside it, so a lookup that failed — or came back
  // empty for a reason nobody had thought of — left the row open and said
  // nothing, and an open row is not cosmetic: it is what the 2C2P webhook
  // matches on. Seen in the wild on 28 Oct 2026. The PATCH matches on the
  // order id and the status itself, so it never needed the lookup.
  //
  // Nothing here is swallowed any more. The employee's cancel has already
  // happened in the database and the response stays ok either way — what
  // changes is that a failure leaves a line with the order id in it rather
  // than no trace at all.
  const tx = await supabaseRest<{ cart_token: string }[]>(
    `payment_transactions?staff_order_id=eq.${pgValue(id)}&status=eq.pending&select=cart_token&limit=1`,
  ).catch((err) => {
    console.error("[staff/orders/cancel] could not read the payment row", { id, err });
    return [] as { cart_token: string }[];
  });

  // No row is ordinary: an order cancelled before it ever reached payment
  // has nothing to release.
  if (tx?.[0]?.cart_token) {
    await releaseStock(tx[0].cart_token).catch((err) => {
      console.error("[staff/orders/cancel] could not release the Shopify hold", { id, err });
    });
  }

  await supabaseRest(`payment_transactions?staff_order_id=eq.${pgValue(id)}&status=eq.pending`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "failed", resp_desc: "cancelled by the employee" }),
  }).catch((err) => {
    console.error("[staff/orders/cancel] could not close the payment row", { id, err });
  });

  return NextResponse.json({ ok: true });
}

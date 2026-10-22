import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { auditStaffSale, badRequest, guard } from "@/lib/staff-sale-admin";
import { ORDER_COLUMNS, reasonTh, type StaffOrder, type StaffOrderStatus } from "@/lib/staff-sale";
import { staffRpc, type RpcResult } from "@/lib/staff-sale-rpc";

// Admin: staff orders, and the two things an admin can do to one — give the
// allowance back after a refund, or cancel one that is stuck unpaid.

const STATUSES: StaffOrderStatus[] = ["pending", "paid", "expired", "cancelled", "refunded"];

export async function GET(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;

  const sp = req.nextUrl.searchParams;
  const round = sp.get("round");
  const status = sp.get("status");
  const flagged = sp.get("flagged") === "1";

  let query = `staff_orders?select=${ORDER_COLUMNS}&order=created_at.desc&limit=1000`;
  if (round) query += `&round_id=eq.${pgValue(round)}`;
  if (status && STATUSES.includes(status as StaffOrderStatus)) {
    query += `&status=eq.${pgValue(status)}`;
  }
  // "ต้องคืนเงิน" covers both ways an order ends up needing a human: money
  // taken with no allowance left, and money taken with no Shopify order.
  if (flagged) query += `&or=(needs_refund.is.true,shopify_sync_status.eq.failed)`;

  const orders = await supabaseRest<StaffOrder[]>(query);

  const userIds = [...new Set(orders.map((o) => o.user_id))];
  type UserRow = { id: string; display_name: string | null; shopify_customer_id: string | null };
  const users: UserRow[] = userIds.length
    ? await supabaseRest<UserRow[]>(
        `users?id=in.(${userIds.map((id) => pgValue(id)).join(",")})&select=id,display_name,shopify_customer_id&limit=2000`,
      ).catch(() => [])
    : [];
  const byId = new Map(users.map((u) => [u.id, u] as const));

  const rounds: { id: string; name: string }[] = await supabaseRest<{ id: string; name: string }[]>(
    `staff_rounds?select=id,name&limit=200`,
  ).catch(() => []);
  const roundName = new Map(rounds.map((r) => [r.id, r.name] as const));

  return NextResponse.json({
    ok: true,
    orders: orders.map((o) => ({
      ...o,
      subtotal_thb: Number(o.subtotal_thb),
      round_name: roundName.get(o.round_id) ?? null,
      display_name: byId.get(o.user_id)?.display_name ?? null,
      shopify_customer_id: byId.get(o.user_id)?.shopify_customer_id ?? null,
    })),
    serverNow: Date.now(),
  });
}

export async function PATCH(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const action = typeof body?.action === "string" ? body.action : "";
  if (!id) return badRequest("ไม่พบคำสั่งซื้อ");

  const rows = await supabaseRest<StaffOrder[]>(
    `staff_orders?id=eq.${pgValue(id)}&select=${ORDER_COLUMNS}&limit=1`,
  );
  const order = rows?.[0];
  if (!order) return NextResponse.json({ ok: false, error: "ไม่พบคำสั่งซื้อ" }, { status: 404 });

  if (action === "refund_restore") {
    // The refund itself happens in Shopify or 2C2P — this only gives the
    // employee their allowance and the shelf its stock back, which nothing
    // tells this database about. Hence a button somebody presses after
    // doing the refund, and an audit row saying who said so.
    const res = await staffRpc<RpcResult>("staff_refund_restore", { p_order: id });
    if (!res?.ok) {
      return badRequest(reasonTh(res?.reason));
    }
    await auditStaffSale(req, "staff_sale.refund_restore", id, {
      round_id: order.round_id,
      staff_email: order.staff_email,
      restored_thb: res.restored_thb ?? Number(order.subtotal_thb),
      shopify_order_id: order.shopify_order_id,
    });
    return NextResponse.json({ ok: true, restored_thb: res.restored_thb });
  }

  if (action === "cancel") {
    const res = await staffRpc<RpcResult>("staff_cancel_order", { p_order: id, p_user: null });
    if (!res?.ok) return badRequest(reasonTh(res?.reason));
    await auditStaffSale(req, "staff_sale.order_cancel", id, {
      round_id: order.round_id,
      staff_email: order.staff_email,
      subtotal_thb: Number(order.subtotal_thb),
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_flag") {
    // The flag is a note to a human, so a human clears it. Kept separate
    // from the refund button: "I have dealt with this" and "give the
    // allowance back" are not the same statement.
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : "";
    await supabaseRest(`staff_orders?id=eq.${pgValue(id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        needs_refund: false,
        note: note ? `${order.note ? `${order.note} · ` : ""}${note}` : order.note,
      }),
    });
    await auditStaffSale(req, "staff_sale.order_clear_flag", id, {
      round_id: order.round_id,
      staff_email: order.staff_email,
      note: note || null,
    });
    return NextResponse.json({ ok: true });
  }

  return badRequest("ไม่รู้จักคำสั่งนี้");
}

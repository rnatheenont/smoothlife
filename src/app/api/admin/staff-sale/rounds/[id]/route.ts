import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { auditStaffSale, badRequest, guard } from "@/lib/staff-sale-admin";
import {
  ITEM_COLUMNS,
  ORDER_COLUMNS,
  ROUND_COLUMNS,
  parseRoundInput,
  type RoundStatus,
  type StaffOrder,
  type StaffRound,
  type StaffRoundItem,
} from "@/lib/staff-sale";

// Admin: one round — its price list, its numbers, and editing it.

const STATUSES: RoundStatus[] = ["draft", "open", "closed"];

async function loadRound(id: string): Promise<StaffRound | null> {
  const rows = await supabaseRest<StaffRound[]>(
    `staff_rounds?id=eq.${pgValue(id)}&select=${ROUND_COLUMNS}&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stop = guard(req);
  if (stop) return stop;
  const { id } = await params;

  const round = await loadRound(id);
  if (!round) return NextResponse.json({ ok: false, error: "ไม่พบรอบนี้" }, { status: 404 });

  const [items, orders, verifications, entitlements] = await Promise.all([
    supabaseRest<StaffRoundItem[]>(
      `staff_round_items?round_id=eq.${pgValue(id)}&select=${ITEM_COLUMNS}&order=product_slug.asc&limit=2000`,
    ),
    supabaseRest<StaffOrder[]>(
      `staff_orders?round_id=eq.${pgValue(id)}&select=${ORDER_COLUMNS}&order=created_at.desc&limit=5000`,
    ),
    supabaseRest<{ user_id: string; staff_email_canonical: string; verified_at: string }[]>(
      `staff_verifications?round_id=eq.${pgValue(id)}&select=user_id,staff_email_canonical,verified_at&order=verified_at.desc&limit=5000`,
    ),
    supabaseRest<{ user_id: string; cap_thb: number; reserved_thb: number; spent_thb: number }[]>(
      `staff_entitlements?round_id=eq.${pgValue(id)}&select=user_id,cap_thb,reserved_thb,spent_thb&limit=5000`,
    ),
  ]);

  // Best sellers, counted from what was actually paid for rather than from
  // sold_qty — sold_qty is the shelf's running total and a refund takes it
  // back down, which is right for the shelf and wrong for "what sold".
  const soldByVariant = new Map<string, { qty: number; thb: number; slug: string }>();
  for (const o of orders) {
    if (o.status !== "paid") continue;
    for (const l of o.lines ?? []) {
      const cur = soldByVariant.get(l.variant_id) ?? { qty: 0, thb: 0, slug: l.product_slug };
      cur.qty += Number(l.qty);
      cur.thb += Number(l.qty) * Number(l.staff_price);
      soldByVariant.set(l.variant_id, cur);
    }
  }

  const paid = orders.filter((o) => o.status === "paid");
  return NextResponse.json({
    ok: true,
    round: { ...round, cap_thb: Number(round.cap_thb) },
    items: items.map((i) => ({
      ...i,
      regular_price: Number(i.regular_price),
      staff_price: Number(i.staff_price),
    })),
    orders: orders.map((o) => ({ ...o, subtotal_thb: Number(o.subtotal_thb) })),
    verifications,
    entitlements: entitlements.map((e) => ({
      ...e,
      cap_thb: Number(e.cap_thb),
      reserved_thb: Number(e.reserved_thb),
      spent_thb: Number(e.spent_thb),
    })),
    overview: {
      verified: verifications.length,
      buyers: new Set(paid.map((o) => o.user_id)).size,
      sold_thb: paid.reduce((s, o) => s + Number(o.subtotal_thb), 0),
      orders_paid: paid.length,
      orders_pending: orders.filter((o) => o.status === "pending").length,
      needs_refund: orders.filter((o) => o.needs_refund).length,
      sync_failed: orders.filter((o) => o.shopify_sync_status === "failed").length,
      top: [...soldByVariant.entries()]
        .map(([variant_id, v]) => ({ variant_id, ...v }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10),
    },
    serverNow: Date.now(),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stop = guard(req);
  if (stop) return stop;
  const { id } = await params;

  const before = await loadRound(id);
  if (!before) return NextResponse.json({ ok: false, error: "ไม่พบรอบนี้" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("ข้อมูลไม่ถูกต้อง");

  // Two shapes, because they are two different decisions: changing the
  // status is one click from the list, changing the dates and the cap is a
  // form. Mixing them would let a save that was only meant to rename a
  // round also open it.
  if (typeof body.status === "string" && Object.keys(body).length === 1) {
    const status = body.status as RoundStatus;
    if (!STATUSES.includes(status)) return badRequest("สถานะไม่ถูกต้อง");

    if (status === "open") {
      const open = await supabaseRest<{ id: string; name: string }[]>(
        `staff_rounds?status=eq.open&id=neq.${pgValue(id)}&select=id,name&limit=1`,
      );
      // Refused rather than closing the other one: two open rounds means two
      // caps per person, and which of them to close is not this click's call.
      if (open?.[0]) {
        return badRequest(`ยังมีรอบ "${open[0].name}" เปิดอยู่ — ปิดรอบนั้นก่อน`);
      }
      const items = await supabaseRest<{ id: string }[]>(
        `staff_round_items?round_id=eq.${pgValue(id)}&enabled=is.true&select=id&limit=1`,
      );
      if (!items?.[0]) return badRequest("ยังไม่มีสินค้าในรอบนี้ — เพิ่มสินค้าก่อนเปิดขาย");
    }

    await supabaseRest(`staff_rounds?id=eq.${pgValue(id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    });
    await auditStaffSale(req, "staff_sale.round_status", id, {
      name: before.name,
      status: { from: before.status, to: status },
    });
    return NextResponse.json({ ok: true });
  }

  const parsed = parseRoundInput(body);
  if ("error" in parsed) return badRequest(parsed.error);

  const capChanged = Number(before.cap_thb) !== parsed.input.cap_thb;

  await supabaseRest(`staff_rounds?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ ...parsed.input, updated_at: new Date().toISOString() }),
  });

  // Changing the cap changes it for the people already in the round too.
  //
  // It used to apply only to whoever verified next, on the reasoning that an
  // allowance already granted is a promise. In practice an admin who edits
  // this number has decided what the round's allowance is, and a page that
  // quietly keeps the old one for everybody who signed up first is a page
  // that lies about its own setting.
  //
  // The floor is what each person has already committed: a cap below
  // `reserved + spent` is a cap the database refuses, and it would mean
  // taking back money that is already in a payment page or already paid.
  let capApplied = 0;
  let capFloored = 0;
  if (capChanged) {
    const ents = await supabaseRest<
      { user_id: string; cap_thb: number; reserved_thb: number; spent_thb: number }[]
    >(
      `staff_entitlements?round_id=eq.${pgValue(id)}&select=user_id,cap_thb,reserved_thb,spent_thb&limit=5000`,
    ).catch(() => []);

    for (const e of ents) {
      const committed = Number(e.reserved_thb) + Number(e.spent_thb);
      const next = Math.max(parsed.input.cap_thb, committed);
      if (next === Number(e.cap_thb)) continue;
      await supabaseRest(
        `staff_entitlements?round_id=eq.${pgValue(id)}&user_id=eq.${pgValue(e.user_id)}`,
        {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ cap_thb: next, updated_at: new Date().toISOString() }),
        },
      ).catch((err) => {
        console.error("[staff-sale] could not move an entitlement's cap", e.user_id, err);
      });
      capApplied += 1;
      if (next > parsed.input.cap_thb) capFloored += 1;
    }
  }

  await auditStaffSale(req, "staff_sale.round_edit", id, {
    name: { from: before.name, to: parsed.input.name },
    starts_at: { from: before.starts_at, to: parsed.input.starts_at },
    ends_at: { from: before.ends_at, to: parsed.input.ends_at },
    cap_thb: { from: Number(before.cap_thb), to: parsed.input.cap_thb },
    payment_window_min: { from: before.payment_window_min, to: parsed.input.payment_window_min },
    ...(capChanged ? { entitlements_updated: capApplied, entitlements_floored: capFloored } : {}),
  });

  return NextResponse.json({
    ok: true,
    note: capChanged
      ? capApplied === 0
        ? "วงเงินใหม่ใช้กับทุกคนในรอบนี้แล้ว"
        : capFloored > 0
          ? `ปรับวงเงินให้คนที่ยืนยันแล้ว ${capApplied} คน · ${capFloored} คนลดลงไม่ได้ถึงตัวเลขใหม่ เพราะใช้หรือกันวงเงินไปเกินกว่านั้นแล้ว`
          : `ปรับวงเงินให้คนที่ยืนยันแล้ว ${capApplied} คนด้วย`
      : undefined,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stop = guard(req);
  if (stop) return stop;
  const { id } = await params;

  const round = await loadRound(id);
  if (!round) return NextResponse.json({ ok: false, error: "ไม่พบรอบนี้" }, { status: 404 });

  // Only a round nobody has touched. Deleting cascades to its price list,
  // its verifications and its orders, and an order is a record of money.
  const orders = await supabaseRest<{ id: string }[]>(
    `staff_orders?round_id=eq.${pgValue(id)}&select=id&limit=1`,
  );
  if (orders?.[0]) return badRequest("รอบนี้มีคำสั่งซื้อแล้ว ลบไม่ได้ — ปิดรอบแทน");
  if (round.status !== "draft") return badRequest("ลบได้เฉพาะรอบที่ยังเป็นร่าง");

  await supabaseRest(`staff_rounds?id=eq.${pgValue(id)}`, { method: "DELETE", returning: false });
  await auditStaffSale(req, "staff_sale.round_delete", id, { name: round.name });
  return NextResponse.json({ ok: true });
}

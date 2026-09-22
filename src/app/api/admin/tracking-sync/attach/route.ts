import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getOrderForTrackingSync, setFulfillmentTracking } from "@/lib/shopify-admin";
import { trackingMode } from "@/lib/tracking-apply";

// A follow-up parcel, settled by a person.
//
// soko files the second parcel of an order as "#4161_F", and the sync
// deliberately leaves those alone: the order is already fulfilled and closed
// in Shopify, so there is nothing to fulfil and the only honest write is to
// add the number to the parcel list the order already carries. Shopify has
// been showing that list all along — #2055 has five numbers on it, added one
// a month by hand, and #4157's second box was keyed in the same day the sync
// skipped it. This is that keystroke, with the order looked up rather than
// remembered.
//
// It never emails. The shipping-update mail lists every number on the order,
// so on a repeat-shipment order it re-announces parcels delivered months ago;
// whoever adds the number tells the customer themselves.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LogRow = {
  id: string;
  order_ref: string;
  tracking_number: string;
  courier: string | null;
  resolved_order_name: string | null;
  action: string;
  reason: string | null;
  resolved_at: string | null;
};

/** The marker the decision writes on a follow-up parcel. */
const FOLLOW_UP = /_F|ของส่งตาม/;

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const decision = body?.decision === "attach" ? "attach" : body?.decision === "skip" ? "skip" : "";
  if (!id || !decision) {
    return NextResponse.json({ ok: false, error: "ต้องระบุ id และ decision" }, { status: 400 });
  }

  const [row] = await supabaseRest<LogRow[]>(
    `tracking_sync_log?id=eq.${encodeURIComponent(id)}` +
      `&select=id,order_ref,tracking_number,courier,resolved_order_name,action,reason,resolved_at&limit=1`,
  );
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });
  if (row.action !== "not-eligible" || !FOLLOW_UP.test(`${row.order_ref} ${row.reason ?? ""}`)) {
    return NextResponse.json({ ok: false, error: "รายการนี้ไม่ใช่ของส่งตาม" }, { status: 400 });
  }
  // Two admins on the page at once would otherwise both write.
  if (row.resolved_at) {
    return NextResponse.json({ ok: false, error: "รายการนี้ถูกจัดการไปแล้ว" }, { status: 409 });
  }

  let applied = false;

  if (decision === "attach") {
    if (trackingMode() === "dry-run") {
      return NextResponse.json(
        { ok: false, error: "ตอนนี้อยู่โหมดทดลอง (dry-run) — ยังเขียนลง Shopify ไม่ได้" },
        { status: 409 },
      );
    }
    const order = await getOrderForTrackingSync(row.resolved_order_name || row.order_ref);
    if (!order) return NextResponse.json({ ok: false, error: "ไม่พบออเดอร์นี้ใน Shopify แล้ว" }, { status: 502 });
    if (!order.fulfillmentId) {
      return NextResponse.json(
        { ok: false, error: "ออเดอร์นี้ยังไม่มี fulfillment — ต้อง fulfill ใน Shopify ก่อน" },
        { status: 409 },
      );
    }
    // The guard that matters. The write replaces the whole tracking set, so
    // an empty read would wipe every number the order already carries — and
    // an order that reached this route has at least the first parcel's.
    if (order.fulfillmentNumbers.length === 0) {
      return NextResponse.json(
        { ok: false, error: "อ่านเลขเดิมของออเดอร์ไม่ได้ — ไม่เขียน เพื่อไม่ให้เลขเก่าหาย" },
        { status: 409 },
      );
    }

    if (order.fulfillmentNumbers.includes(row.tracking_number)) {
      // Someone keyed it in already, which is how this was handled before.
      applied = true;
    } else {
      const res = await setFulfillmentTracking({
        fulfillmentId: order.fulfillmentId,
        number: row.tracking_number,
        numbers: [...order.fulfillmentNumbers, row.tracking_number],
        company: row.courier || order.shipments[0]?.company || "Kerry Express Thailand",
        notifyCustomer: false,
      });
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error ?? "เขียนลง Shopify ไม่สำเร็จ" }, { status: 502 });
      }
      applied = true;
    }
  }

  // Every row for this parcel, not just the one clicked: runs before 15 Sep
  // logged the same follow-up on each pass, and leaving the older rows open
  // would keep the parcel in the queue after it had been dealt with.
  await supabaseRest(
    `tracking_sync_log?tracking_number=eq.${encodeURIComponent(row.tracking_number)}` +
      `&action=eq.not-eligible&resolved_at=is.null`,
    {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        resolved_at: new Date().toISOString(),
        resolution: decision === "attach" ? "attached" : "ignored",
        applied: applied || undefined,
      }),
    },
  );

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: decision === "attach" ? "tracking.attach" : "tracking.skip",
      target: row.resolved_order_name || row.order_ref,
      detail: { logId: row.id, parcelRef: row.order_ref, number: row.tracking_number, notified: false },
    }),
  }).catch((err) => console.error("[tracking-attach] audit write failed", err));

  return NextResponse.json({ ok: true, applied });
}

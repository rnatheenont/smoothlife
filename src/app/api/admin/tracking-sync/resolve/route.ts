import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getOrderForTrackingSync, setFulfillmentTracking, createFulfillmentWithTracking } from "@/lib/shopify-admin";
import { trackingMode } from "@/lib/tracking-apply";

// Settling one mismatch.
//
// A mismatch means Shopify already carries a different number for the order,
// and the sync deliberately refuses to guess which is right — so until now the
// only way to close one was to open Shopify and key it in by hand, the exact
// step this integration exists to remove.
//
// Two outcomes, both final and both recorded: take soko's number, or keep
// what Shopify has. Overwriting can send a customer to the wrong parcel, so
// what was replaced is written to the audit log before anything changes.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LogRow = {
  id: string;
  order_ref: string;
  tracking_number: string;
  courier: string | null;
  resolved_order_name: string | null;
  existing_numbers: string[] | null;
  action: string;
  resolved_at: string | null;
};

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const resolution = body?.resolution === "overwritten" ? "overwritten" : body?.resolution === "ignored" ? "ignored" : "";
  if (!id || !resolution) {
    return NextResponse.json({ ok: false, error: "ต้องระบุ id และ resolution" }, { status: 400 });
  }

  const [row] = await supabaseRest<LogRow[]>(
    `tracking_sync_log?id=eq.${encodeURIComponent(id)}&select=id,order_ref,tracking_number,courier,resolved_order_name,existing_numbers,action,resolved_at&limit=1`
  );
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });
  if (row.action !== "conflict") {
    return NextResponse.json({ ok: false, error: "รายการนี้ไม่ใช่รายการที่เลขไม่ตรงกัน" }, { status: 400 });
  }
  // Two admins on the page at once would otherwise both write, and the second
  // would overwrite a decision the first had just made.
  if (row.resolved_at) {
    return NextResponse.json({ ok: false, error: "รายการนี้ถูกจัดการไปแล้ว" }, { status: 409 });
  }

  let applied = false;
  let notified = false;
  let error: string | null = null;

  if (resolution === "overwritten") {
    const mode = trackingMode();
    if (mode === "dry-run") {
      return NextResponse.json(
        { ok: false, error: "ตอนนี้อยู่โหมดทดลอง (dry-run) — ยังเขียนลง Shopify ไม่ได้" },
        { status: 409 }
      );
    }
    const order = await getOrderForTrackingSync(row.resolved_order_name || row.order_ref);
    if (!order) {
      error = "ไม่พบออเดอร์นี้ใน Shopify แล้ว";
    } else {
      notified = mode === "write-notify";
      const res = order.fulfillmentId
        ? await setFulfillmentTracking({
            fulfillmentId: order.fulfillmentId,
            number: row.tracking_number,
            company: row.courier || "Kerry Express Thailand",
            notifyCustomer: notified,
          })
        : order.openFulfillmentOrderIds.length > 0
          ? await createFulfillmentWithTracking({
              fulfillmentOrderIds: order.openFulfillmentOrderIds,
              number: row.tracking_number,
              company: row.courier || "Kerry Express Thailand",
              notifyCustomer: notified,
            })
          : { ok: false, error: "ไม่มี fulfillment ให้เขียนทับ" };
      if (res.ok) applied = true;
      else {
        error = res.error ?? "เขียนลง Shopify ไม่สำเร็จ";
        notified = false;
      }
    }
    if (error) return NextResponse.json({ ok: false, error }, { status: 502 });
  }

  await supabaseRest(`tracking_sync_log?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ resolved_at: new Date().toISOString(), resolution, applied: applied || undefined }),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: resolution === "overwritten" ? "tracking.overwrite" : "tracking.ignore",
      target: row.resolved_order_name || row.order_ref,
      detail: {
        logId: row.id,
        newNumber: row.tracking_number,
        replaced: row.existing_numbers ?? [],
        notified,
      },
    }),
  }).catch((err) => console.error("[tracking-resolve] audit write failed", err));

  return NextResponse.json({ ok: true, applied, notified });
}

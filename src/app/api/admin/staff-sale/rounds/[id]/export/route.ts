import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { auditStaffSale, guard } from "@/lib/staff-sale-admin";
import { ORDER_COLUMNS, ROUND_COLUMNS, type StaffOrder, type StaffRound } from "@/lib/staff-sale";
import { csvDocument, csvSlug } from "@/lib/csv";
import { fulfilmentOption } from "@/lib/staff-fulfilment";

// Admin: one round as a CSV, for HR and accounting.
//
// One row per order line rather than per order: the questions this file gets
// opened to answer are "what did each person buy" and "what did we sell at
// what discount", and both need the line.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stop = guard(req);
  if (stop) return stop;
  const { id } = await params;

  const rounds = await supabaseRest<StaffRound[]>(
    `staff_rounds?id=eq.${pgValue(id)}&select=${ROUND_COLUMNS}&limit=1`,
  );
  const round = rounds?.[0];
  if (!round) return NextResponse.json({ ok: false, error: "ไม่พบรอบนี้" }, { status: 404 });

  const orders = await supabaseRest<StaffOrder[]>(
    `staff_orders?round_id=eq.${pgValue(id)}&select=${ORDER_COLUMNS}&order=created_at.asc&limit=10000`,
  );

  const header = [
    "รอบ",
    "อีเมลพนักงาน",
    "สถานะ",
    "เลขออร์เดอร์ Shopify",
    "เวลาที่สั่ง",
    "เวลาที่จ่าย",
    "วิธีรับของ",
    "ชื่อเล่นที่ติดกล่อง",
    "ชั้น",
    "สินค้า",
    "ตัวเลือก",
    "จำนวน",
    "ราคาปกติ",
    "ราคาพนักงาน",
    "ส่วนลดต่อชิ้น",
    "รวมบรรทัดนี้",
    "รวมทั้งออร์เดอร์",
    "ต้องคืนเงิน",
  ];

  const rows: unknown[][] = [];
  for (const o of orders) {
    for (const l of o.lines ?? []) {
      rows.push(
        [
          round.name,
          o.staff_email,
          o.status,
          o.shopify_order_id ?? "",
          o.created_at,
          o.paid_at ?? "",
          // Whoever packs the round sorts on this column: a collection
          // never goes near a courier.
          fulfilmentOption(o.fulfilment ?? "ship").label,
          o.pickup_name ?? "",
          o.pickup_floor ?? "",
          l.product_slug,
          l.variant_id,
          l.qty,
          Number(l.regular_price).toFixed(2),
          Number(l.staff_price).toFixed(2),
          (Number(l.regular_price) - Number(l.staff_price)).toFixed(2),
          (Number(l.staff_price) * Number(l.qty)).toFixed(2),
          Number(o.subtotal_thb).toFixed(2),
          o.needs_refund ? "ใช่" : "",
        ],
      );
    }
  }

  await auditStaffSale(req, "staff_sale.export", id, { name: round.name, rows: rows.length });

  const stamp = new Date().toISOString().slice(0, 10);
  // csvSlug rather than the pattern that was here: that one kept letters and
  // digits only, and Thai vowels and tone marks are neither, so a round
  // called "รอบปีใหม่" downloaded as "รอบป-ใหม".
  const slug = csvSlug(round.name);
  return new NextResponse(
    csvDocument(header, rows),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="staff-sale-${slug}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

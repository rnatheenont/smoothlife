import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { auditStaffSale, guard } from "@/lib/staff-sale-admin";
import { ORDER_COLUMNS, ROUND_COLUMNS, type StaffOrder, type StaffRound } from "@/lib/staff-sale";

// Admin: one round as a CSV, for HR and accounting.
//
// One row per order line rather than per order: the questions this file gets
// opened to answer are "what did each person buy" and "what did we sell at
// what discount", and both need the line.

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  // Excel reads a leading =, +, - or @ as a formula. A product name is not
  // a formula, and a staff list is exactly the kind of file that gets
  // forwarded around.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

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

  const lines = [header.map(csvCell).join(",")];
  for (const o of orders) {
    for (const l of o.lines ?? []) {
      lines.push(
        [
          round.name,
          o.staff_email,
          o.status,
          o.shopify_order_id ?? "",
          o.created_at,
          o.paid_at ?? "",
          l.product_slug,
          l.variant_id,
          l.qty,
          Number(l.regular_price).toFixed(2),
          Number(l.staff_price).toFixed(2),
          (Number(l.regular_price) - Number(l.staff_price)).toFixed(2),
          (Number(l.staff_price) * Number(l.qty)).toFixed(2),
          Number(o.subtotal_thb).toFixed(2),
          o.needs_refund ? "ใช่" : "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  await auditStaffSale(req, "staff_sale.export", id, { name: round.name, rows: lines.length - 1 });

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = round.name.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40);
  return new NextResponse(
    // The BOM is what makes Excel on Windows read this as UTF-8 instead of
    // turning every Thai character into mojibake.
    `﻿${lines.join("\n")}`,
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="staff-sale-${slug}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

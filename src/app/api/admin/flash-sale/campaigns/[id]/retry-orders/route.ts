import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { UUID_RE } from "@/lib/flash-sale";
import { createFlashSaleOrder, FLASH_SALE_TX_COLUMNS, type FlashSaleTransaction } from "@/lib/flash-sale-orders";

// Admin: create the Shopify orders for paid reservations whose order failed
// (Shopify down, a variant problem…). Safe to press repeatedly: an entry that
// already has its order is not selected.
export const maxDuration = 60;

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  // Paid a minute or more ago and still no order (not one the webhook is creating right now).
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const entries = await supabaseRest<{ id: string }[]>(
    `flash_sale_queue?campaign_id=eq.${pgValue(id)}&status=eq.paid&shopify_order_id=is.null&paid_at=lt.${pgValue(cutoff)}&select=id&limit=20`
  );
  let created = 0;
  let failed = 0;
  for (const entry of entries) {
    const [tx] = await supabaseRest<FlashSaleTransaction[]>(
      `payment_transactions?flash_sale_entry_id=eq.${pgValue(entry.id)}&status=eq.success&shopify_order_id=is.null&select=${FLASH_SALE_TX_COLUMNS}&order=confirmed_at.asc&limit=1`
    );
    if (!tx) continue;
    const result = await createFlashSaleOrder(tx);
    if (result.ok) created += 1;
    else failed += 1;
  }
  return NextResponse.json({ ok: true, created, failed, checked: entries.length });
}

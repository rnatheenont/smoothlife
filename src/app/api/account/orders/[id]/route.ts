import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCustomerOrderDetail, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { buildTracking } from "@/lib/tracking";

// One order, for the customer it belongs to. Read-only — never writes to
// Shopify. Ownership is enforced inside getCustomerOrderDetail, which needs
// the viewer's Shopify customer id and returns null for anyone else's order.

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  const [row] = await supabaseRest<{ shopify_customer_id: string | null }[]>(
    `users?id=eq.${uid}&select=shopify_customer_id`
  );
  if (!row?.shopify_customer_id) {
    return NextResponse.json({ ok: false, linked: false, error: "บัญชียังไม่ได้เชื่อมกับประวัติการสั่งซื้อ" }, { status: 404 });
  }

  const order = await getCustomerOrderDetail(row.shopify_customer_id, params.id);
  if (!order) {
    return NextResponse.json({ ok: false, error: "ไม่พบคำสั่งซื้อนี้" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order, tracking: buildTracking(order) });
}

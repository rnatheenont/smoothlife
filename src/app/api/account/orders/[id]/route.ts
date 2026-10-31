import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCustomerOrderDetail, shopifyAdminConfigured, storeLabel, type StoreKey } from "@/lib/shopify-admin";
import { otherStoreLinks } from "@/lib/store-links";
import { staffShopifyCustomerId } from "@/lib/staff-customer";
import { buildTracking } from "@/lib/tracking";
import { trackingForOrders } from "@/lib/shipment-sync";

// One order, for the customer it belongs to. Read-only — never writes to
// Shopify. Ownership is enforced inside getCustomerOrderDetail, which needs
// the viewer's Shopify customer id and returns null for anyone else's order.

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  // ?store=smoothe|dentiste for an order placed in one of the other stores.
  const storeParam = req.nextUrl.searchParams.get("store");
  const store: StoreKey = storeParam === "smoothe" || storeParam === "dentiste" ? storeParam : "smoothlife";

  let customerId: string | null = null;
  if (store === "smoothlife") {
    const [row] = await supabaseRest<{ shopify_customer_id: string | null }[]>(
      `users?id=eq.${uid}&select=shopify_customer_id`
    );
    customerId = row?.shopify_customer_id ?? null;
  } else {
    customerId = (await otherStoreLinks(uid)).find((l) => l.store === store)?.shopifyCustomerId ?? null;
  }
  // The employee's second customer record, when there is one. A staff-shop
  // order sits on whichever customer owns the work email rather than on the
  // one the account is linked to, so this endpoint said "ไม่พบคำสั่งซื้อนี้"
  // for an order the list beside it had just shown — the list learned about
  // the second customer and this did not.
  const staffId = store === "smoothlife" ? await staffShopifyCustomerId(uid, customerId).catch(() => null) : null;

  if (!customerId && !staffId) {
    return NextResponse.json({ ok: false, linked: false, error: "บัญชียังไม่ได้เชื่อมกับประวัติการสั่งซื้อ" }, { status: 404 });
  }

  // Ownership still decides: getCustomerOrderDetail returns null unless the
  // order belongs to the customer it is asked about, so asking twice widens
  // who this viewer is, never what they may see.
  let order = customerId ? await getCustomerOrderDetail(customerId, params.id, store) : null;
  if (!order && staffId) {
    order = await getCustomerOrderDetail(staffId, params.id, store);
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "ไม่พบคำสั่งซื้อนี้" }, { status: 404 });
  }

  const feed = await trackingForOrders([order]);
  return NextResponse.json({ ok: true, order: { ...order, storeLabel: storeLabel(store) }, tracking: buildTracking(order, feed) });
}

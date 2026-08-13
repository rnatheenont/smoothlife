import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCustomerOrders, shopifyAdminConfigured } from "@/lib/shopify-admin";

// Real Shopify order history for the logged-in customer — read-only, never
// writes to Shopify. `linked: false` means the account isn't matched to a
// Shopify customer record yet (or Shopify Admin isn't configured), which
// the UI shows as an honest explanation rather than an empty order list.
export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ linked: false, orders: [] }, { status: 401 });
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ linked: false, orders: [] });
  }

  const [row] = await supabaseRest<{ shopify_customer_id: string | null }[]>(
    `users?id=eq.${uid}&select=shopify_customer_id`
  );
  if (!row?.shopify_customer_id) {
    return NextResponse.json({ linked: false, orders: [] });
  }

  const orders = await getCustomerOrders(row.shopify_customer_id, 20);
  return NextResponse.json({ linked: true, orders: orders || [] });
}

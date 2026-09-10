import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCustomerOrders, getCustomerTotals, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { buildTracking } from "@/lib/tracking";
import { trackingForOrders } from "@/lib/shipment-sync";

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

  // 50, not 20: the busiest repeat customer in the store is on 11 orders
  // today, so 20 hides nothing yet — but it is a ceiling that would start
  // silently dropping the oldest orders off the page the day someone reaches
  // their 21st, with nothing on screen to say anything was left out. Other
  // call sites of getCustomerOrders already pass 100 and 250, so the page
  // size itself is not a constraint.
  const [orders, totals] = await Promise.all([
    getCustomerOrders(row.shopify_customer_id, 50),
    // The customer record's own lifetime counters, which do not depend on our
    // token's reach. Shopify withholds orders older than sixty days from an
    // app without read_all_orders, so a customer with four purchases can be
    // shown a list of one — and a list that quietly loses three orders reads
    // as "you lost my history", which is worse than saying what we can see.
    getCustomerTotals(row.shopify_customer_id),
  ]);
  // Tracking is assembled here rather than in the browser because whether a
  // courier feed exists is a server-side fact (an API key), and a client that
  // guessed it would quietly claim we know less — or more — than we do.
  // Courier scans for every parcel on the page, in one read — and a quiet
  // nudge for any number the feed has never been told about.
  const feed = await trackingForOrders(orders || []);
  const withTracking = (orders || []).map((o) => ({ ...o, tracking: buildTracking(o, feed) }));
  const hidden = totals ? Math.max(0, totals.orders - withTracking.length) : 0;
  return NextResponse.json({ linked: true, orders: withTracking, totals, hidden });
}

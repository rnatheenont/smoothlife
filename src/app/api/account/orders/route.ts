import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCustomerOrders, getCustomerTotals, shopifyAdminConfigured, storeLabel } from "@/lib/shopify-admin";
import { linkOtherStores, otherStoreOrders } from "@/lib/store-links";
import { recalculateLoyaltyForUser } from "@/lib/loyalty-cron";
import { buildTracking } from "@/lib/tracking";
import { trackingForOrders } from "@/lib/shipment-sync";

// Real Shopify order history for the logged-in customer, from Smooth Life and
// any of the group's other stores the account is matched to — read-only,
// never writes to Shopify. `linked: false` means the account isn't matched to a
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

  // Smooth E and Dentiste orders too, for accounts matched to a customer
  // there. An account that hasn't been looked up in a store (or not today) is
  // looked up now, so customers who signed up before this existed are covered
  // without signing in again.
  const other = await linkOtherStores(uid);
  if (other.added) void recalculateLoyaltyForUser(uid).catch(() => {});

  if (!row?.shopify_customer_id && other.links.length === 0) {
    return NextResponse.json({ linked: false, orders: [] });
  }

  // 50, not 20: the busiest repeat customer in the store is on 11 orders
  // today, so 20 hides nothing yet — but it is a ceiling that would start
  // silently dropping the oldest orders off the page the day someone reaches
  // their 21st, with nothing on screen to say anything was left out. Other
  // call sites of getCustomerOrders already pass 100 and 250, so the page
  // size itself is not a constraint.
  const [orders, totals, others] = await Promise.all([
    row?.shopify_customer_id ? getCustomerOrders(row.shopify_customer_id, 50) : Promise.resolve([]),
    // The customer record's own lifetime counters, which do not depend on our
    // token's reach. Shopify withholds orders older than sixty days from an
    // app without read_all_orders, so a customer with four purchases can be
    // shown a list of one — and a list that quietly loses three orders reads
    // as "you lost my history", which is worse than saying what we can see.
    row?.shopify_customer_id ? getCustomerTotals(row.shopify_customer_id) : Promise.resolve(null),
    otherStoreOrders(other.links, 50),
  ]);

  // One list, newest first, each order carrying the store it came from.
  const all = [...(orders || []), ...others.flatMap((o) => o.orders)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Tracking is assembled here rather than in the browser because whether a
  // courier feed exists is a server-side fact (an API key), and a client that
  // guessed it would quietly claim we know less — or more — than we do.
  // Courier scans for every parcel on the page, in one read — and a quiet
  // nudge for any number the feed has never been told about.
  const feed = await trackingForOrders(all);
  const withTracking = all.map((o) => ({ ...o, storeLabel: storeLabel(o.store), tracking: buildTracking(o, feed) }));

  // Orders the stores know about but did not list (older than their token can see).
  const hiddenIn = (count: number | undefined, listed: number) => (count === undefined ? 0 : Math.max(0, count - listed));
  const hidden =
    hiddenIn(totals?.orders, (orders || []).length) +
    others.reduce((n, o) => n + hiddenIn(o.totals?.orders, o.orders.length), 0);
  const combinedTotals =
    totals || others.some((o) => o.totals)
      ? {
          orders: (totals?.orders ?? 0) + others.reduce((n, o) => n + (o.totals?.orders ?? 0), 0),
          spend: (totals?.spend ?? 0) + others.reduce((n, o) => n + (o.totals?.spend ?? 0), 0),
          currency: totals?.currency ?? others.find((o) => o.totals)?.totals?.currency ?? "THB",
        }
      : null;
  return NextResponse.json({
    linked: true,
    orders: withTracking,
    totals: combinedTotals,
    hidden,
    stores: [...(row?.shopify_customer_id ? ["smoothlife"] : []), ...other.links.map((l) => l.store)],
  });
}

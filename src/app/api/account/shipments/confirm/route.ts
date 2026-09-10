import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { getCustomerOrders, shopifyAdminConfigured } from "@/lib/shopify-admin";

// The customer telling us their parcel arrived.
//
// Nobody sends us a delivery scan — not the courier, not the warehouse — so
// the tracker either waits two weeks and infers delivery from age, or it asks
// the one person who actually knows. This is that ask. It is the same reason
// the chat has a "this is sorted" button: the customer holds facts the system
// cannot see, and a single tap is a fair price for the truth.
//
// Only their own parcels: the tracking number is checked against the orders on
// their own Shopify customer record before anything is written, so this cannot
// be used to mark a stranger's shipment delivered.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const trackingNumber = typeof body?.trackingNumber === "string" ? body.trackingNumber.trim() : "";
  if (!trackingNumber || trackingNumber.length > 64) {
    return NextResponse.json({ ok: false, error: "ไม่พบเลขพัสดุนี้" }, { status: 400 });
  }

  const [row] = await supabaseRest<{ shopify_customer_id: string | null }[]>(
    `users?id=eq.${pgValue(uid)}&select=shopify_customer_id&limit=1`
  );
  if (!row?.shopify_customer_id) {
    return NextResponse.json({ ok: false, error: "ไม่พบคำสั่งซื้อของคุณ" }, { status: 404 });
  }

  const orders = await getCustomerOrders(row.shopify_customer_id, 50);
  const owned = (orders ?? []).some((o) => o.shipments.some((s) => s.number === trackingNumber));
  if (!owned) {
    return NextResponse.json({ ok: false, error: "เลขพัสดุนี้ไม่ได้อยู่ในคำสั่งซื้อของคุณ" }, { status: 403 });
  }

  const now = new Date().toISOString();
  await supabaseRest("shipment_tracking?on_conflict=tracking_number", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      tracking_number: trackingNumber,
      // Recorded as its own source: a courier feed arriving later should be
      // able to tell what the customer said apart from what was scanned.
      provider: "customer",
      status: "delivered",
      raw_status: "customer_confirmed",
      delivered_at: now,
      updated_at: now,
    }),
  });

  return NextResponse.json({ ok: true, deliveredAt: now });
}

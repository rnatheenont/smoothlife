import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";

// Tells the checkout page whether a payment actually completed. The customer
// coming back from 2C2P proves only that they finished on 2C2P's side — the
// authoritative "paid" write comes from the backend webhook
// (api/webhooks/2c2p-checkout), so anything customer-facing that claims
// success has to read the row that webhook updates, never just the redirect.
//
// cartToken is a server-generated crypto.randomUUID() (see ../init/route.ts)
// that only ever reached the customer who started this payment, so it is safe
// as the lookup key without a session: guessing one is not feasible, and the
// response deliberately carries no personal data beyond the order number.
export async function GET(req: NextRequest) {
  const cartToken = req.nextUrl.searchParams.get("cartToken");
  if (!cartToken) return NextResponse.json({ ok: false, error: "missing cartToken" }, { status: 400 });
  // supabaseRest talks to PostgREST with the service-role key and takes a raw
  // query string, so an un-validated value here is a filter-injection with
  // full table access — appending `&select=*&or=(...)` would dump every
  // customer's email, phone and shipping address out of payment_transactions.
  // cart_token is always a crypto.randomUUID(), so anything that isn't shaped
  // like one is not a real token and never needs to reach the database.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cartToken)) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const [transaction] = await supabaseRest<
    { status: string; shopify_order_id: string | null; amount: number; resp_desc: string | null }[]
  >(
    `payment_transactions?cart_token=eq.${encodeURIComponent(cartToken)}&select=status,shopify_order_id,amount,resp_desc&limit=1`
  );

  if (!transaction) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    // "pending" is the normal answer for a second or two after the customer
    // returns — 2C2P's webhook and the browser race, and the webhook usually
    // wins by a hair, but not always.
    status: transaction.status,
    orderId: transaction.shopify_order_id,
    amount: transaction.amount,
    failureReason: transaction.status === "failed" ? transaction.resp_desc : null,
  });
}

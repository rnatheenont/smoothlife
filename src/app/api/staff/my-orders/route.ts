import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase-server";
import { staffOrdersFor } from "@/lib/staff-shop";

// The employee's own staff orders, for the account pages.
//
// Only the unpaid ones matter here: a paid staff order is a Shopify order
// and shows up in the ordinary history with its tag. One that is still
// waiting for payment exists nowhere but this table, and without this it is
// invisible — an allowance held by an order the person cannot see.
//
// Answers with an empty list rather than a 401 for a signed-out visitor:
// the account page asks for this alongside its other fetches, and "no staff
// orders" is the true answer for almost everyone who loads it.

export async function GET(req: NextRequest) {
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId || !supabaseConfigured()) return NextResponse.json({ ok: true, orders: [] });

  const orders = await staffOrdersFor(userId, 20);
  return NextResponse.json({
    ok: true,
    orders: orders
      .filter((o) => o.status === "pending")
      .map((o) => ({
        id: o.id,
        subtotal_thb: o.subtotal_thb,
        expires_at: o.expires_at,
        payment_url: o.payment_url ?? null,
        lines: (o.lines ?? []).map((l) => ({
          product_slug: l.product_slug,
          qty: Number(l.qty),
          staff_price: Number(l.staff_price),
        })),
      })),
    serverNow: Date.now(),
  });
}

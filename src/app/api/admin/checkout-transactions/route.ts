import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";

// Lists recent one-time custom-checkout purchases (src/app/api/checkout/init)
// so an admin can find a transaction to refund. Distinct from
// real_subscription_charges, which has its own bookkeeping-only
// "mark as refunded" action elsewhere — this is the general-purchase
// side, and (once TWOC2P_MERCHANT_PRIVATE_KEY/TWOC2P_PUBLIC_KEY are set,
// see lib/2c2p.ts) can call the real 2C2P refund API, not just note-taking.
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, transactions: [] });

  const rows = await supabaseRest<
    {
      id: string;
      invoice_no: string;
      amount: number;
      currency_code: string;
      status: string;
      shopify_order_id: string | null;
      contact_email: string | null;
      contact_phone: string | null;
      refunded_at: string | null;
      refund_note: string | null;
      created_at: string;
      confirmed_at: string | null;
    }[]
  >(
    "payment_transactions?status=in.(success,refunded)&select=id,invoice_no,amount,currency_code,status,shopify_order_id,contact_email,contact_phone,refunded_at,refund_note,created_at,confirmed_at&order=created_at.desc&limit=100"
  );

  return NextResponse.json({ ok: true, transactions: rows });
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { orderNamesByGid, storeAdminHandle } from "@/lib/shopify-admin";

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
  // The shop's handle travels with the list so the page can link an order
  // into Shopify's admin. It is read here rather than in the page because the
  // module that knows it also holds the API credentials, and importing that
  // from a client component ships the credentials to the browser.
  const adminHandle = storeAdminHandle("smoothlife");

  if (!supabaseConfigured())
    return NextResponse.json({ ok: true, transactions: [], adminHandle });

  const rows = await supabaseRest<
    {
      id: string;
      invoice_no: string;
      amount: number;
      currency_code: string;
      status: string;
      shopify_order_id: string | null;
      tran_ref: string | null;
      contact_email: string | null;
      contact_phone: string | null;
      refunded_at: string | null;
      refund_note: string | null;
      created_at: string;
      confirmed_at: string | null;
    }[]
  >(
    "payment_transactions?status=in.(success,refunded)&select=id,invoice_no,amount,currency_code,status,shopify_order_id,contact_email,contact_phone,tran_ref,refunded_at,refund_note,created_at,confirmed_at&order=created_at.desc&limit=100"
  );

  // The order's name — "#4639" — rather than the 14-digit id Shopify keys it
  // by. The name is what the order is called everywhere a person looks at it,
  // and the id is not written on anything they can compare it against.
  //
  // Half of them cost nothing: the flash-sale checkout already writes the name
  // into tran_ref (see refund-route.ts, which tells the two checkouts apart by
  // exactly that). Only our own 2C2P rows have to be asked for, and that call
  // is batched and cached by order — a name never changes once it exists.
  const needLookup = rows
    .filter((r) => !r.tran_ref?.trim().startsWith("#"))
    .map((r) => r.shopify_order_id);
  const looked = await orderNamesByGid(needLookup).catch(
    () => new Map<string, string>(),
  );

  const transactions = rows.map((r) => ({
    ...r,
    order_name:
      r.tran_ref?.trim().startsWith("#")
        ? r.tran_ref.trim()
        : (r.shopify_order_id ? looked.get(r.shopify_order_id) : null) ?? null,
  }));

  return NextResponse.json({ ok: true, transactions, adminHandle });
}

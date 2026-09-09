import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { getCustomerShopifyAddress, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { thaiAddressFromShopify } from "@/lib/shopify-address";

// The address from the customer's own past orders, offered on their account.
//
// It used to be handed over only in the moment an account was first linked to
// a Shopify customer, carried in localStorage — so anyone linked afterwards
// (support attaching an older account, say) never saw it, and someone who
// dismissed it once lost it for good. Read live instead: it belongs to them,
// it is already in Shopify, and asking a returning customer to retype the
// address we have been shipping to for a year is the kind of small insult
// that makes an account feel like paperwork.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: true, suggestion: null });
  }

  const [row] = await supabaseRest<{ shopify_customer_id: string | null }[]>(
    `users?id=eq.${pgValue(uid)}&select=shopify_customer_id&limit=1`
  ).catch(() => []);
  if (!row?.shopify_customer_id) return NextResponse.json({ ok: true, suggestion: null });

  const found = await getCustomerShopifyAddress(row.shopify_customer_id);
  const draft = thaiAddressFromShopify(found?.address);
  if (!draft) return NextResponse.json({ ok: true, suggestion: null });

  // Already in their address book — offering it again would just be clutter.
  // Matched on postcode plus the house number, which is the part people do not
  // rewrite; the rest of a Thai address line varies by who typed it.
  const saved = await supabaseRest<{ address_line: string; postal_code: string }[]>(
    `addresses?user_id=eq.${pgValue(uid)}&select=address_line,postal_code`
  ).catch(() => []);
  const houseNumber = draft.address_line.match(/^\S+/)?.[0] ?? "";
  const duplicate = saved.some(
    (a) => a.postal_code === draft.postal_code && houseNumber && a.address_line.includes(houseNumber)
  );
  if (duplicate) return NextResponse.json({ ok: true, suggestion: null });

  return NextResponse.json({ ok: true, suggestion: draft, source: found?.source ?? null });
}

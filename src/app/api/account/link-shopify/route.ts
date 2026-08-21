import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { shopifyAdminConfigured } from "@/lib/shopify-admin";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";

// Self-service retry for accounts that ended up with no shopify_customer_id
// (pre-dates this link system, or the auth-time attempt errored). Every
// auth entry point already tries this on signup/login — this just re-runs
// the same match-by-email/phone logic on demand from the orders page, so a
// customer isn't stuck needing a support agent unless their Shopify order
// really was placed under different contact info than their account.
export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบเชื่อมบัญชียังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const [current] = await supabaseRest<
    { display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]
  >(`users?id=eq.${uid}&select=display_name,phone,shopify_customer_id`);
  if (!current) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });

  if (current.shopify_customer_id) {
    return NextResponse.json({ ok: true, linked: true });
  }

  const [emailIdentity] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid`
  );

  const result = await linkOrCreateShopifyCustomer(uid, {
    email: emailIdentity?.provider_uid || null,
    phone: current.phone,
    currentDisplayName: current.display_name,
    currentPhone: current.phone,
    createIfMissing: false,
  });

  return NextResponse.json({ ok: true, linked: Boolean(result.shopifyCustomerId) });
}

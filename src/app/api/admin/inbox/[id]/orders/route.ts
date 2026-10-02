import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import {
  getCustomerOrders,
  findShopifyCustomerByEmail,
  findShopifyCustomerByPhone,
  shopifyAdminConfigured,
} from "@/lib/shopify-admin";
import { ConversationRow } from "@/lib/conversations";

// This customer's real order history, from Shopify.
//
// Its own route rather than part of the conversation GET, which staff keep
// open all day and which already fires five lookups in parallel to stay quick.
// An order list is wanted on maybe one thread in five, and a Shopify round trip
// — two of them when the account was never linked — is not a price worth paying
// on every open for something usually unread. The tab fetches it when opened.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  if (!shopifyAdminConfigured()) {
    return NextResponse.json({ ok: true, orders: [], matchedBy: null, reason: "shopify_not_configured" });
  }

  const [conversation] = await supabaseRest<ConversationRow[]>(
    `conversations?id=eq.${pgValue(params.id)}&select=*&limit=1`
  );
  if (!conversation) return NextResponse.json({ ok: false, error: "ไม่พบบทสนทนานี้" }, { status: 404 });
  if (!conversation.user_id) {
    return NextResponse.json({ ok: true, orders: [], matchedBy: null, reason: "no_account" });
  }

  const uid = pgValue(conversation.user_id);
  const [[user], [email]] = await Promise.all([
    supabaseRest<{ phone: string | null; shopify_customer_id: string | null }[]>(
      `users?id=eq.${uid}&select=phone,shopify_customer_id&limit=1`
    ).catch((): { phone: string | null; shopify_customer_id: string | null }[] => []),
    supabaseRest<{ provider_uid: string }[]>(
      `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid&limit=1`
    ).catch((): { provider_uid: string }[] => []),
  ]);

  // Three ways in, cheapest first. A linked account answers immediately; the
  // email and phone searches are the same two the real account-linking flow
  // uses, so "no orders" here means the same thing it would mean there, rather
  // than "nobody ever pressed the link button".
  let customerId = user?.shopify_customer_id ?? null;
  let matchedBy: "linked" | "email" | "phone" | null = customerId ? "linked" : null;

  if (!customerId && email?.provider_uid) {
    const match = await findShopifyCustomerByEmail(email.provider_uid).catch(() => null);
    if (match?.id) {
      customerId = match.id;
      matchedBy = "email";
    }
  }
  if (!customerId && user?.phone) {
    const match = await findShopifyCustomerByPhone(user.phone).catch(() => null);
    if (match?.id) {
      customerId = match.id;
      matchedBy = "phone";
    }
  }
  if (!customerId) {
    return NextResponse.json({ ok: true, orders: [], matchedBy: null, reason: "no_shopify_customer" });
  }

  const orders = await getCustomerOrders(customerId, 5).catch(() => null);
  if (!orders) {
    return NextResponse.json({ ok: false, error: "อ่านคำสั่งซื้อจาก Shopify ไม่สำเร็จ" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, orders, matchedBy, customerId });
}

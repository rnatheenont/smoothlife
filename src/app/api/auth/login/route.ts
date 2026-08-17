import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { tierProgress } from "@/data/coupons";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบบัญชีผู้ใช้ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" }, { status: 503 });
  }
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  const identities = await supabaseRest<{ user_id: string; secret_hash: string | null }[]>(
    `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(normalizedEmail)}&select=user_id,secret_hash`
  );
  const identity = identities[0];
  if (!identity || !identity.secret_hash || !verifyPassword(password, identity.secret_hash)) {
    return NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const [user] = await supabaseRest<
    { id: string; display_name: string; created_at: string; phone: string | null; gender: string | null; birthdate: string | null; avatar_url: string | null; shopify_customer_id: string | null }[]
  >(`users?id=eq.${identity.user_id}&select=id,display_name,created_at,phone,gender,birthdate,avatar_url,shopify_customer_id`);
  const [balanceRow] = await supabaseRest<{ balance: number }[]>(
    `points_balance?user_id=eq.${identity.user_id}&select=balance`
  );
  const points = balanceRow?.balance ?? 0;

  // Backfill the Shopify link on login too, for accounts created before
  // this existed — only bother looking it up once (skip if already linked).
  let phone = user.phone;
  let displayName = user.display_name;
  let addressSuggestion = null;
  if (!user.shopify_customer_id) {
    const shopifyLink = await linkOrCreateShopifyCustomer(user.id, {
      email: normalizedEmail,
      currentDisplayName: user.display_name,
      currentPhone: user.phone,
    });
    if (shopifyLink.phone) phone = shopifyLink.phone;
    if (shopifyLink.displayName) displayName = shopifyLink.displayName;
    addressSuggestion = shopifyLink.addressSuggestion;
  }

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: displayName,
      email: normalizedEmail,
      phone,
      gender: user.gender,
      birthdate: user.birthdate,
      avatar: user.avatar_url,
      provider: "email",
      real: true,
      points,
      tier: tierProgress(points).current,
      createdAt: user.created_at,
      shopifyAddressSuggestion: addressSuggestion,
    },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions);
  return res;
}

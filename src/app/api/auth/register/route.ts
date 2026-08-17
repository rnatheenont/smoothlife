import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";
import { isPasswordStrongEnough, PASSWORD_REQUIREMENT_TH } from "@/lib/password-policy";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { tierProgress } from "@/data/coupons";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบบัญชีผู้ใช้ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" }, { status: 503 });
  }
  const { name, phone, email, password } = await req.json().catch(() => ({}));
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
  }
  if (!phone || typeof phone !== "string" || phone.trim().length < 9) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกเบอร์โทรศัพท์" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || !isPasswordStrongEnough(password)) {
    return NextResponse.json({ ok: false, error: PASSWORD_REQUIREMENT_TH }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  // One transaction (users + auth_identities + points_ledger inserts) so a
  // failure partway through never leaves a half-created account.
  let result: { user_id: string; created_at: string }[];
  try {
    result = await supabaseRest<{ user_id: string; created_at: string }[]>("rpc/register_member", {
      method: "POST",
      body: JSON.stringify({
        p_display_name: name.trim(),
        p_email: normalizedEmail,
        p_secret_hash: hashPassword(password),
      }),
    });
  } catch (err) {
    if (String(err).includes("email_taken")) {
      return NextResponse.json({ ok: false, error: "อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ" }, { status: 409 });
    }
    throw err;
  }
  const user = result[0];

  await supabaseRest(`users?id=eq.${user.user_id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ phone: normalizedPhone }),
  });

  // Best-effort: link to an existing Shopify customer if this email already
  // has purchase history, or create one on Shopify if not, so Shopify stays
  // the complete customer list either way. Never blocks registration on
  // failure (network hiccup, missing Admin scope, etc).
  const shopifyLink = await linkOrCreateShopifyCustomer(user.user_id, {
    email: normalizedEmail,
    phone: normalizedPhone,
    currentDisplayName: name.trim(),
    currentPhone: normalizedPhone,
  });

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.user_id,
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      gender: null,
      birthdate: null,
      avatar: null,
      provider: "email",
      real: true,
      points: 100,
      tier: tierProgress(100).current,
      createdAt: user.created_at,
      shopifyAddressSuggestion: shopifyLink.addressSuggestion,
    },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(user.user_id), sessionCookieOptions);
  return res;
}

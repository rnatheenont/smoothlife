import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";
import { isPasswordStrongEnough, PASSWORD_REQUIREMENT_TH } from "@/lib/password-policy";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { getUserLoyalty } from "@/lib/user-tier";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

// Completes the "register with an email that's already taken" reclaim
// flow — only reachable after /api/auth/register has already sent a code
// to that exact email, so a correct code here is real proof of ownership,
// not just knowledge of the address.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบบัญชีผู้ใช้ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" }, { status: 503 });
  }
  const { name, phone, email, password, code } = await req.json().catch(() => ({}));
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
  if (!code || typeof code !== "string") {
    return NextResponse.json({ ok: false, error: "กรุณากรอกรหัสยืนยัน" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  const [challenge] = await supabaseRest<
    { id: string; code_hash: string; expires_at: string; attempt_count: number }[]
  >(
    `otp_challenges?provider=eq.register_reclaim&target=eq.${encodeURIComponent(normalizedEmail)}&consumed_at=is.null&order=created_at.desc&limit=1&select=id,code_hash,expires_at,attempt_count`
  );
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "รหัสหมดอายุ กรุณาลองสมัครใหม่อีกครั้ง" }, { status: 401 });
  }
  if (challenge.attempt_count >= MAX_ATTEMPTS) {
    return NextResponse.json({ ok: false, error: "กรอกรหัสผิดหลายครั้งเกินไป กรุณาลองสมัครใหม่อีกครั้ง" }, { status: 429 });
  }
  if (challenge.code_hash !== hashCode(code.trim())) {
    await supabaseRest(`otp_challenges?id=eq.${challenge.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ attempt_count: challenge.attempt_count + 1 }),
    });
    return NextResponse.json({ ok: false, error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  }
  await supabaseRest(`otp_challenges?id=eq.${challenge.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });

  const [identity] = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(normalizedEmail)}&select=user_id`
  );
  if (!identity) {
    return NextResponse.json({ ok: false, error: "ไม่พบบัญชีนี้ กรุณาลองสมัครใหม่อีกครั้ง" }, { status: 404 });
  }
  const uid = identity.user_id;

  await supabaseRest(`auth_identities?user_id=eq.${uid}&provider=eq.email`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ secret_hash: hashPassword(password) }),
  });
  await supabaseRest(`users?id=eq.${uid}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ display_name: name.trim(), phone: normalizedPhone }),
  });

  const [user] = await supabaseRest<
    { id: string; display_name: string; created_at: string; phone: string | null; gender: string | null; birthdate: string | null; avatar_url: string | null; shopify_customer_id: string | null }[]
  >(`users?id=eq.${uid}&select=id,display_name,created_at,phone,gender,birthdate,avatar_url,shopify_customer_id`);

  let addressSuggestion = null;
  if (!user.shopify_customer_id) {
    const shopifyLink = await linkOrCreateShopifyCustomer(uid, {
      email: normalizedEmail,
      phone: normalizedPhone,
      currentDisplayName: user.display_name,
      currentPhone: user.phone,
    });
    addressSuggestion = shopifyLink.addressSuggestion;
  }

  const [balanceRow] = await supabaseRest<{ balance: number }[]>(`points_balance?user_id=eq.${uid}&select=balance`);
  const points = balanceRow?.balance ?? 0;
  const loyalty = await getUserLoyalty(uid);

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.display_name,
      email: normalizedEmail,
      phone: user.phone,
      gender: user.gender,
      birthdate: user.birthdate,
      avatar: user.avatar_url,
      provider: "email",
      real: true,
      points,
      tier: loyalty.tier,
      tierSpend: loyalty.spend,
      tierOrders: loyalty.orders,
      createdAt: user.created_at,
      shopifyAddressSuggestion: addressSuggestion,
    },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(uid), sessionCookieOptions);
  return res;
}

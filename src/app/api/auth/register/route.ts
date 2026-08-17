import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";
import { isPasswordStrongEnough, PASSWORD_REQUIREMENT_TH } from "@/lib/password-policy";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { tierProgress } from "@/data/coupons";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";
import { emailConfigured, sendEmail, otpEmailHtml } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

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

  // Email already registered — rather than a hard dead-end, offer to update
  // that account's name/phone/password, but only once verified as the real
  // owner via a code sent to that same email (never trust "I typed the
  // right email" alone, or anyone who just knows someone else's email could
  // silently take over their account).
  const existingIdentity = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(normalizedEmail)}&select=user_id`
  );
  if (existingIdentity.length) {
    const recent = await supabaseRest<{ created_at: string }[]>(
      `otp_challenges?provider=eq.register_reclaim&target=eq.${encodeURIComponent(normalizedEmail)}&order=created_at.desc&limit=1&select=created_at`
    );
    if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ ok: false, error: "กรุณารอสักครู่ก่อนขอรหัสใหม่อีกครั้ง" }, { status: 429 });
    }

    const code = String(randomInt(100000, 1000000));
    await supabaseRest("otp_challenges", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        provider: "register_reclaim",
        target: normalizedEmail,
        code_hash: hashCode(code),
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      }),
    });

    if (emailConfigured()) {
      try {
        await sendEmail(normalizedEmail, "ยืนยันตัวตนเพื่ออัปเดตบัญชี - Smoothlife.com", otpEmailHtml(code));
      } catch (err) {
        console.error("[register] failed to send reclaim code via Resend", err);
        return NextResponse.json({ ok: false, error: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
      }
      return NextResponse.json({
        ok: false,
        needsVerification: true,
        error: "อีเมลนี้ถูกใช้งานแล้ว เราส่งรหัสยืนยันไปที่อีเมลนี้ กรอกรหัสเพื่ออัปเดตข้อมูลบัญชีเดิม",
      });
    }
    if (process.env.VERCEL_ENV !== "production") {
      return NextResponse.json({
        ok: false,
        needsVerification: true,
        devCode: code,
        error: "อีเมลนี้ถูกใช้งานแล้ว กรอกรหัสยืนยัน (dev mode) เพื่ออัปเดตข้อมูลบัญชีเดิม",
      });
    }
    return NextResponse.json({ ok: false, error: "อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ" }, { status: 409 });
  }

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

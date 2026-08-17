import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { emailConfigured, sendEmail, resetLinkEmailHtml } from "@/lib/email";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Public — the whole point of "forgot password" is that the customer isn't
// logged in. Always responds the same generic way regardless of whether the
// email is actually registered, so this can't be used to enumerate accounts.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบบัญชีผู้ใช้ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" }, { status: 503 });
  }
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const recent = await supabaseRest<{ created_at: string }[]>(
    `otp_challenges?provider=eq.password_reset&target=eq.${encodeURIComponent(normalizedEmail)}&order=created_at.desc&limit=1&select=created_at`
  );
  if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json({ ok: false, error: "กรุณารอสักครู่ก่อนขอลิงก์ใหม่อีกครั้ง" }, { status: 429 });
  }

  const identities = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(normalizedEmail)}&select=user_id`
  );
  const genericResponse = {
    ok: true,
    message: "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องอีเมล",
  };
  if (!identities.length) return NextResponse.json(genericResponse);

  const token = randomBytes(32).toString("base64url");
  await supabaseRest("otp_challenges", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      provider: "password_reset",
      target: normalizedEmail,
      code_hash: hashToken(token),
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    }),
  });

  const resetPath = `/account/change-password/reset?token=${token}`;

  if (emailConfigured()) {
    try {
      const resetUrl = new URL(resetPath, req.url).toString();
      await sendEmail(normalizedEmail, "ตั้งรหัสผ่านใหม่ - Smoothlife.com", resetLinkEmailHtml(resetUrl));
    } catch (err) {
      console.error("[forgot-password] failed to send via Resend", err);
      return NextResponse.json({ ok: false, error: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
    }
    return NextResponse.json(genericResponse);
  }

  // No email provider configured — NEVER leak the reset link in a real
  // production response (that link resets a password with no further
  // verification, so leaking it is a full account takeover). Only surface
  // it on preview/local for testing.
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ ...genericResponse, devResetLink: resetPath });
  }
  return NextResponse.json(genericResponse);
}

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { emailConfigured, sendEmail, otpEmailHtml } from "@/lib/email";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
    `otp_challenges?provider=eq.email&target=eq.${encodeURIComponent(normalizedEmail)}&order=created_at.desc&limit=1&select=created_at`
  );
  if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json({ ok: false, error: "กรุณารอสักครู่ก่อนขอรหัสใหม่อีกครั้ง" }, { status: 429 });
  }

  const code = String(randomInt(100000, 1000000));
  await supabaseRest("otp_challenges", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      provider: "email",
      target: normalizedEmail,
      code_hash: hashCode(code),
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    }),
  });

  if (emailConfigured()) {
    try {
      await sendEmail(normalizedEmail, "รหัสยืนยันเข้าสู่ระบบ Smoothlife.com", otpEmailHtml(code));
    } catch (err) {
      console.error("[email-otp send] failed to send via Resend", err);
      return NextResponse.json({ ok: false, error: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, emailSent: true });
  }

  // No email provider configured yet — same graceful-degrade pattern as
  // change-password/request: surface the code directly so the flow is fully
  // testable end-to-end and just needs Resend plugged in later.
  return NextResponse.json({ ok: true, emailSent: false, devCode: code });
}

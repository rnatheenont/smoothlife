import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { emailConfigured, sendEmail, resetLinkEmailHtml } from "@/lib/email";
import { emailSendLimited } from "@/lib/rate-limit";

// "ลืมรหัสผ่าน" for a personal admin account — the same shape as the
// customer flow in /api/auth/forgot-password, with the differences an admin
// account deserves:
//   - its own provider value, so a token minted for a shopper can never be
//     spent against an admin account (they share one table)
//   - fifteen minutes instead of thirty
//   - suspended accounts get the generic answer and no email; a revoked
//     admin must not be able to let themselves back in
//
// There is no reset for the shared password: it is an environment variable,
// not an account, and nothing here can change it. The login screen says so
// rather than leaving someone waiting for an email that cannot come.
export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  // Same generic answer whether or not the address belongs to an admin:
  // confirming it does would tell an attacker exactly which address to go
  // after, and an admin address is worth more than a shopper's.
  const generic = {
    ok: true,
    message: "หากอีเมลนี้เป็นบัญชีแอดมิน เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว ลิงก์มีอายุ 15 นาที",
  };

  const recent = await supabaseRest<{ created_at: string }[]>(
    `otp_challenges?provider=eq.admin_password_reset&target=eq.${pgValue(normalizedEmail)}&order=created_at.desc&limit=1&select=created_at`
  ).catch((): { created_at: string }[] => []);
  if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json({ ok: false, error: "กรุณารอสักครู่ก่อนขอลิงก์ใหม่อีกครั้ง" }, { status: 429 });
  }
  if (await emailSendLimited(req)) {
    return NextResponse.json({ ok: false, error: "มีการขอลิงก์จากเครือข่ายนี้บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  const [user] = await supabaseRest<{ id: string; status: string }[]>(
    `admin_users?email=eq.${pgValue(normalizedEmail)}&select=id,status&limit=1`
  ).catch((): { id: string; status: string }[] => []);
  if (!user || user.status !== "active") return NextResponse.json(generic);

  const token = randomBytes(32).toString("base64url");
  await supabaseRest("otp_challenges", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      provider: "admin_password_reset",
      target: normalizedEmail,
      code_hash: hashToken(token),
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    }),
  });

  const resetPath = `/admin/reset-password?token=${token}`;

  if (emailConfigured()) {
    try {
      await sendEmail(
        normalizedEmail,
        "ตั้งรหัสผ่านแอดมินใหม่ - Smoothlife.com",
        resetLinkEmailHtml(new URL(resetPath, req.url).toString())
      );
    } catch (err) {
      console.error("[admin forgot-password] failed to send via Resend", err);
      return NextResponse.json({ ok: false, error: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
    }
    return NextResponse.json(generic);
  }

  // Without an email provider there is nowhere to send it. The link resets an
  // admin password with no further check, so it is never put in a production
  // response — only on preview and local, for testing.
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ ...generic, devResetLink: resetPath });
  }
  return NextResponse.json({
    ok: false,
    error: "ระบบส่งอีเมลยังไม่ได้ตั้งค่า จึงส่งลิงก์ไม่ได้ กรุณาให้ผู้ดูแลตั้งรหัสผ่านใหม่ให้จากหน้าจัดการผู้ใช้",
  });
}

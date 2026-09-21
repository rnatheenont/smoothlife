import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";
import { isPasswordStrongEnough, PASSWORD_REQUIREMENT_TH } from "@/lib/password-policy";

// Spends a token from /api/admin/forgot-password. Mirrors the customer
// confirm route, against admin_users and only tokens minted as
// admin_password_reset — the provider filter is what stops a shopper's reset
// token being spent here.
export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ ok: false, error: "ลิงก์ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || !isPasswordStrongEnough(password)) {
    return NextResponse.json({ ok: false, error: PASSWORD_REQUIREMENT_TH }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const [challenge] = await supabaseRest<
    { id: string; target: string; code_hash: string; expires_at: string; consumed_at: string | null }[]
  >(`otp_challenges?provider=eq.admin_password_reset&code_hash=eq.${pgValue(tokenHash)}&order=created_at.desc&limit=1`).catch(
    (): { id: string; target: string; code_hash: string; expires_at: string; consumed_at: string | null }[] => []
  );

  if (!challenge) {
    return NextResponse.json({ ok: false, error: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
  }
  // The DB filter already matched exactly; the constant-time compare is
  // defence in depth, same as the customer route.
  const a = Buffer.from(tokenHash);
  const b = Buffer.from(challenge.code_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false, error: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
  }
  if (challenge.consumed_at) {
    return NextResponse.json({ ok: false, error: "ลิงก์นี้ถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่" }, { status: 400 });
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่" }, { status: 400 });
  }

  // Checked again at spend time, not just when the link was sent: an account
  // suspended in between must not be reopened by a link already in an inbox.
  const [user] = await supabaseRest<{ id: string; status: string }[]>(
    `admin_users?email=eq.${pgValue(challenge.target)}&select=id,status&limit=1`
  ).catch((): { id: string; status: string }[] => []);
  if (!user || user.status !== "active") {
    await supabaseRest(`otp_challenges?id=eq.${pgValue(challenge.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    });
    return NextResponse.json({ ok: false, error: "บัญชีนี้ใช้งานไม่ได้แล้ว กรุณาติดต่อผู้ดูแลระบบ" }, { status: 403 });
  }

  await supabaseRest(`admin_users?id=eq.${pgValue(user.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ password_hash: hashPassword(password) }),
  });
  await supabaseRest(`otp_challenges?id=eq.${pgValue(challenge.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });

  return NextResponse.json({ ok: true });
}

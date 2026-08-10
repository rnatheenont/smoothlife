import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่ได้ตั้งค่า" }, { status: 503 });
  }
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ ok: false, error: "ลิงก์ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const challenges = await supabaseRest<
    { id: string; target: string; code_hash: string; expires_at: string; consumed_at: string | null }[]
  >(`otp_challenges?provider=eq.password_reset&code_hash=eq.${tokenHash}&order=created_at.desc&limit=1`);
  const challenge = challenges[0];

  if (!challenge) {
    return NextResponse.json({ ok: false, error: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
  }
  // hashToken already narrows this to an exact match via the DB filter, but
  // keep a constant-time compare against the stored hash as defense in depth.
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

  await supabaseRest(`auth_identities?provider=eq.email&provider_uid=eq.${encodeURIComponent(challenge.target)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ secret_hash: hashPassword(password) }),
  });
  await supabaseRest(`otp_challenges?id=eq.${challenge.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });

  return NextResponse.json({ ok: true });
}

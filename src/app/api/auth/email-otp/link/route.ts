import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

// Verifies an emailed OTP code and links that email — as a *verified*
// identity — to the currently signed-in user (who got here via phone OTP
// or LINE, not email). Distinct from /api/auth/email-otp/verify, which
// signs the visitor in (finding or creating an account); this route never
// creates a new account, it only attaches a verified email to the existing
// session's user_id.
export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }

  const { email, code } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof code !== "string") {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const [challenge] = await supabaseRest<
    { id: string; code_hash: string; expires_at: string; attempt_count: number }[]
  >(
    `otp_challenges?provider=eq.email&target=eq.${encodeURIComponent(normalizedEmail)}&consumed_at=is.null&order=created_at.desc&limit=1&select=id,code_hash,expires_at,attempt_count`
  );
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "รหัสหมดอายุ กรุณาขอรหัสใหม่" }, { status: 401 });
  }
  if (challenge.attempt_count >= MAX_ATTEMPTS) {
    return NextResponse.json({ ok: false, error: "กรอกรหัสผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่" }, { status: 429 });
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

  const result = await supabaseRest<{ ok: boolean; error: string | null }[]>("rpc/link_email_identity", {
    method: "POST",
    body: JSON.stringify({ p_user_id: uid, p_email: normalizedEmail }),
  });
  const row = result[0];
  if (!row?.ok) {
    return NextResponse.json({ ok: false, error: row?.error || "เชื่อมอีเมลไม่สำเร็จ" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, email: normalizedEmail });
}

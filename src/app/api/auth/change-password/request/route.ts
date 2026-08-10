import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }

  const identities = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid`
  );
  const email = identities[0]?.provider_uid;
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "บัญชีนี้ไม่ได้ผูกกับอีเมล ไม่สามารถเปลี่ยนรหัสผ่านด้วยวิธีนี้ได้" },
      { status: 400 }
    );
  }

  const token = randomBytes(32).toString("base64url");
  await supabaseRest("otp_challenges", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      provider: "password_reset",
      target: email,
      code_hash: hashToken(token),
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    }),
  });

  const resetLink = `/account/change-password/reset?token=${token}`;

  // No email provider is wired up in this project yet (see .env.example —
  // there's no RESEND_API_KEY / SMTP_* etc). NEVER leak the reset link in a
  // real production response — that link resets a password with no further
  // verification, so leaking it is a full account takeover, not just an
  // inconvenience. Only surface it on preview/local (VERCEL_ENV is unset
  // outside Vercel, so this still works with plain `npm run dev`).
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ ok: true, email, emailSent: false, devResetLink: resetLink });
  }
  return NextResponse.json(
    { ok: false, error: "ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบเพื่อเปลี่ยนรหัสผ่าน" },
    { status: 503 }
  );
}

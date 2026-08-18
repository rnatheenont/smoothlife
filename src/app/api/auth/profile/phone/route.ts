import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { verifyFirebasePhoneIdToken, firebaseVerifyConfigured } from "@/lib/firebase-verify";

// Thai E.164 -> local display format, the inverse of toE164Thai on the
// client. Only Thai numbers are supported (same limitation as the rest of
// the phone-OTP flow) — the verified token is the only source of truth for
// the phone number here, never a client-supplied string.
function toLocalThai(e164: string): string {
  if (e164.startsWith("+66")) return "0" + e164.slice(3);
  return e164;
}

// Verifies a Firebase Phone Auth ID token for a *new* number and, if valid,
// replaces the currently signed-in user's phone — both the auth_identities
// (phone_otp) row used for phone login and the display users.phone column.
// Mirrors /api/auth/email-otp/link's role for email.
export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  if (!firebaseVerifyConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยืนยันเบอร์โทรยังไม่ได้ตั้งค่า" }, { status: 503 });
  }

  const { idToken } = await req.json().catch(() => ({}));
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const verified = await verifyFirebasePhoneIdToken(idToken);
  if (!verified) {
    return NextResponse.json({ ok: false, error: "ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 401 });
  }

  const result = await supabaseRest<{ ok: boolean; error: string | null }[]>("rpc/link_phone_identity", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: uid,
      p_phone_e164: verified.phoneNumber,
      p_phone_local: toLocalThai(verified.phoneNumber),
    }),
  });
  const row = result[0];
  if (!row?.ok) {
    return NextResponse.json({ ok: false, error: row?.error || "เปลี่ยนเบอร์โทรไม่สำเร็จ" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, phone: toLocalThai(verified.phoneNumber) });
}

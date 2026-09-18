import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword, createAdminToken, adminCookieOptions, ADMIN_COOKIE } from "@/lib/admin-auth";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyPassword } from "@/lib/password";

type AdminUserRow = {
  id: string;
  email: string;
  password_hash: string;
  role_key: string;
  status: "active" | "suspended";
};

// Two ways in, both landing on the same cookie (see admin-auth.ts):
//   { password }         — the original shared password, kept working
//                           indefinitely so this rollout can never lock the
//                           team out mid-migration.
//   { email, password }  — a personal admin_users account.
// Whichever body shape is present decides which path runs; sending both
// checks the personal account only, since that is the one worth deprecating
// the other in favour of.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (email) {
    if (!supabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
    }
    const [user] = await supabaseRest<AdminUserRow[]>(
      `admin_users?email=eq.${pgValue(email)}&select=id,email,password_hash,role_key,status&limit=1`
    ).catch((): AdminUserRow[] => []);
    // Same generic error whether the email doesn't exist or the password is
    // wrong — confirming which one it was hands an attacker a working email
    // list for free.
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }
    if (user.status === "suspended") {
      return NextResponse.json({ ok: false, error: "บัญชีนี้ถูกระงับการใช้งาน" }, { status: 403 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, createAdminToken({ userId: user.id, role: user.role_key }), adminCookieOptions);
    await supabaseRest(`admin_users?id=eq.${pgValue(user.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ last_login_at: new Date().toISOString() }),
    }).catch(() => {
      // Login already succeeded above; failing to stamp last_login_at is not
      // worth failing the request over.
    });
    return res;
  }

  if (!process.env.ADMIN_PANEL_SECRET) {
    return NextResponse.json({ ok: false, error: "ระบบแอดมินยังไม่ได้ตั้งค่า" }, { status: 503 });
  }
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ ok: false, error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createAdminToken(), adminCookieOptions);
  return res;
}

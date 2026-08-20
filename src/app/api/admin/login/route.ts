import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword, createAdminToken, adminCookieOptions, ADMIN_COOKIE } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_PANEL_SECRET) {
    return NextResponse.json({ ok: false, error: "ระบบแอดมินยังไม่ได้ตั้งค่า" }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ ok: false, error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createAdminToken(), adminCookieOptions);
  return res;
}

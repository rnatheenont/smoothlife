import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const GENDERS = new Set(["male", "female", "other"]);

export async function PATCH(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    patch.display_name = body.name.trim();
  }
  if (typeof body.phone === "string") {
    const digits = body.phone.replace(/\D/g, "");
    if (digits && digits.length !== 10) {
      return NextResponse.json({ ok: false, error: "เบอร์มือถือต้องมี 10 หลัก" }, { status: 400 });
    }
    patch.phone = digits || null;
  }
  if (body.gender === null || (typeof body.gender === "string" && GENDERS.has(body.gender))) {
    patch.gender = body.gender;
  }
  if (typeof body.birthdate === "string" || body.birthdate === null) {
    patch.birthdate = body.birthdate || null;
  }
  if (typeof body.avatar === "string" || body.avatar === null) {
    if (typeof body.avatar === "string" && body.avatar.length > 500_000) {
      return NextResponse.json({ ok: false, error: "ไฟล์รูปใหญ่เกินไป" }, { status: 400 });
    }
    patch.avatar_url = body.avatar || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลที่จะบันทึก" }, { status: 400 });
  }

  const [updated] = await supabaseRest<{ id: string }[]>(`users?id=eq.${uid}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!updated) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

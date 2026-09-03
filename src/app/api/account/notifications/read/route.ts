import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function POST(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const readAt = new Date().toISOString();

  if (body.all === true) {
    await supabaseRest(`notifications?user_id=eq.${uid}&read_at=is.null`, {
      method: "PATCH",
      body: JSON.stringify({ read_at: readAt }),
      returning: false,
    });
    return NextResponse.json({ ok: true });
  }

  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });

  await supabaseRest(`notifications?id=eq.${pgValue(id)}&user_id=eq.${uid}`, {
    method: "PATCH",
    body: JSON.stringify({ read_at: readAt }),
    returning: false,
  });
  return NextResponse.json({ ok: true });
}

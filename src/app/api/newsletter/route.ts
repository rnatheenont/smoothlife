import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งานครับ" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกอีเมลให้ถูกต้อง" }, { status: 400 });
  }

  // Re-subscribing with the same email is a no-op, not an error.
  await supabaseRest("newsletter_subscribers?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    returning: false,
    body: JSON.stringify({ email }),
  });
  return NextResponse.json({ ok: true });
}

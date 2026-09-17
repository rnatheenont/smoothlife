import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { leaveFlashSale, UUID_RE } from "@/lib/flash-sale";

// Step out of line before your turn (a slot already held just runs out).
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  try {
    const result = await leaveFlashSale(id, userId);
    return NextResponse.json({ ok: result.ok, error: result.ok ? undefined : "ไม่มีคิวที่รออยู่" }, { status: result.ok ? 200 : 409 });
  } catch (err) {
    console.error("[flash-sale] leave failed", err);
    return NextResponse.json({ ok: false, error: "ออกจากคิวไม่สำเร็จ" }, { status: 500 });
  }
}

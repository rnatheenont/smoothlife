import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { flashSaleMonitor, UUID_RE } from "@/lib/flash-sale";

// Admin: live numbers for one campaign from the real queue.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  try {
    const monitor = await flashSaleMonitor(id);
    if (!monitor) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
    return NextResponse.json({ ok: true, ...monitor }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/flash-sale] monitor failed", err);
    return NextResponse.json({ ok: false, error: "โหลดข้อมูลคิวไม่สำเร็จ" }, { status: 500 });
  }
}

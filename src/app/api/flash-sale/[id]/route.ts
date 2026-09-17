import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { flashSaleStatus, UUID_RE } from "@/lib/flash-sale";

// The sale page polls this: campaign phase, each product's stock and, for a
// signed-in shopper, their own place in line. Reading it also settles overdue
// reservations (lazy expiry), so the numbers are current.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  try {
    const status = await flashSaleStatus(id, userId);
    if (!status) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
    return NextResponse.json({ ok: true, signedIn: Boolean(userId), ...status }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[flash-sale] status failed", err);
    return NextResponse.json({ ok: false, error: "โหลดข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

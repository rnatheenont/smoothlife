import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CAMPAIGN_COLUMNS, rowToCampaign, type FlashSaleCampaignRow } from "@/lib/flash-sale-campaigns";

// Admin: act on one campaign.
//   PATCH { action: "start_now" } — move starts_at to now (not once it has ended)
//   PATCH { action: "end_now" }   — stamp ended_manually_at (a campaign ended
//                                   before its start is simply cancelled)
//   DELETE                        — remove it
// The conditions are part of each write's filter, so a second click, or a
// click on a campaign someone else already ended, changes nothing.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const now = new Date().toISOString();

  let filter: string;
  let patch: Record<string, string>;
  if (body?.action === "start_now") {
    // ends_at must still be ahead, or the new start would fall after the end.
    filter = `id=eq.${pgValue(id)}&ended_manually_at=is.null&or=(ends_at.is.null,ends_at.gt.${pgValue(now)})`;
    patch = { starts_at: now };
  } else if (body?.action === "end_now") {
    filter = `id=eq.${pgValue(id)}&ended_manually_at=is.null`;
    patch = { ended_manually_at: now };
  } else {
    return NextResponse.json({ ok: false, error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  }

  const rows = await supabaseRest<FlashSaleCampaignRow[]>(`flash_sale_campaigns?${filter}&select=${CAMPAIGN_COLUMNS}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "สถานะแคมเปญเปลี่ยนไปแล้ว รีเฟรชหน้าเพื่อดูล่าสุด" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, campaign: rowToCampaign(rows[0]) });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  const rows = await supabaseRest<{ id: string }[]>(`flash_sale_campaigns?id=eq.${pgValue(id)}&select=id`, {
    method: "DELETE",
  });
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ อาจถูกลบไปแล้ว" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

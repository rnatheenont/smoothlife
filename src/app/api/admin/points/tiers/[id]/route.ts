import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import type { RedemptionTier } from "@/app/api/account/redeem/route";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.pointsCost !== undefined) {
    if (!Number.isFinite(body.pointsCost) || body.pointsCost <= 0) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุแต้มที่ใช้แลกให้ถูกต้อง" }, { status: 400 });
    }
    patch.points_cost = body.pointsCost;
  }
  if (body.discountType !== undefined) {
    if (body.discountType !== "percent" && body.discountType !== "amount") {
      return NextResponse.json({ ok: false, error: "ประเภทส่วนลดต้องเป็น percent หรือ amount" }, { status: 400 });
    }
    patch.discount_type = body.discountType;
  }
  if (body.discountValue !== undefined) {
    const type = body.discountType ?? patch.discount_type;
    if (!Number.isFinite(body.discountValue) || body.discountValue <= 0 || (type === "percent" && body.discountValue > 100)) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุมูลค่าส่วนลดให้ถูกต้อง" }, { status: 400 });
    }
    patch.discount_value = body.discountValue;
  }
  if (body.labelTh !== undefined) patch.label_th = body.labelTh;
  if (body.labelEn !== undefined) patch.label_en = body.labelEn;
  if (typeof body.active === "boolean") patch.active = body.active;

  const [row] = await supabaseRest<RedemptionTier[]>(`points_redemption_tiers?id=eq.${pgValue(params.id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });
  return NextResponse.json({ ok: true, tier: row });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  await supabaseRest(`points_redemption_tiers?id=eq.${pgValue(params.id)}`, { method: "DELETE", returning: false });
  return NextResponse.json({ ok: true });
}

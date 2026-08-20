import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import type { RedemptionTier } from "@/app/api/account/redeem/route";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const tiers = await supabaseRest<(RedemptionTier & { active: boolean })[]>(
    "points_redemption_tiers?select=id,points_cost,discount_type,discount_value,label_th,label_en,active&order=points_cost.asc"
  );
  return NextResponse.json({ ok: true, tiers });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const { pointsCost, discountType, discountValue, labelTh, labelEn } = body;
  if (!Number.isFinite(pointsCost) || pointsCost <= 0) {
    return NextResponse.json({ ok: false, error: "กรุณาระบุแต้มที่ใช้แลกให้ถูกต้อง" }, { status: 400 });
  }
  if (discountType !== "percent" && discountType !== "amount") {
    return NextResponse.json({ ok: false, error: "ประเภทส่วนลดต้องเป็น percent หรือ amount" }, { status: 400 });
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percent" && discountValue > 100)) {
    return NextResponse.json({ ok: false, error: "กรุณาระบุมูลค่าส่วนลดให้ถูกต้อง" }, { status: 400 });
  }
  if (!labelTh || !labelEn) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อรายการทั้งไทยและอังกฤษ" }, { status: 400 });
  }

  const [row] = await supabaseRest<RedemptionTier[]>("points_redemption_tiers", {
    method: "POST",
    body: JSON.stringify({
      points_cost: pointsCost,
      discount_type: discountType,
      discount_value: discountValue,
      label_th: labelTh,
      label_en: labelEn,
      active: true,
    }),
  });
  return NextResponse.json({ ok: true, tier: row }, { status: 201 });
}

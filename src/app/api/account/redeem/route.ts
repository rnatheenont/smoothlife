import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { createAmountDiscountCode, createPercentDiscountCode, shopifyAdminConfigured } from "@/lib/shopify-admin";

export type RedemptionTier = {
  id: string;
  points_cost: number;
  discount_type: "percent" | "amount";
  discount_value: number;
  label_th: string;
  label_en: string;
};

async function getPointBalance(uid: string): Promise<number> {
  const [row] = await supabaseRest<{ balance: number }[]>(`points_balance?user_id=eq.${uid}&select=balance`);
  return row?.balance ?? 0;
}

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ loggedIn: false });
  }
  const [tiers, balance] = await Promise.all([
    supabaseRest<RedemptionTier[]>(
      "points_redemption_tiers?active=eq.true&order=points_cost.asc&select=id,points_cost,discount_type,discount_value,label_th,label_en"
    ),
    getPointBalance(uid),
  ]);
  return NextResponse.json({ loggedIn: true, tiers, pointBalance: balance });
}

// Spends points for a real, single-use Shopify discount code — never a fake
// "you saved X" screen. Creates the code first, then debits the ledger, so
// a Shopify-side failure (missing scope, transient error) never costs the
// customer points for nothing.
export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }
  if (!shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบแลกแต้มยังไม่พร้อมใช้งานค่ะ" }, { status: 503 });
  }

  const { tierId } = await req.json().catch(() => ({}));
  if (!tierId || typeof tierId !== "string") {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const [tier] = await supabaseRest<RedemptionTier[]>(
    `points_redemption_tiers?id=eq.${tierId}&active=eq.true&select=id,points_cost,discount_type,discount_value,label_th,label_en`
  );
  if (!tier) {
    return NextResponse.json({ ok: false, error: "ไม่พบรายการแลกแต้มนี้ค่ะ" }, { status: 404 });
  }

  const balance = await getPointBalance(uid);
  if (balance < tier.points_cost) {
    return NextResponse.json({ ok: false, error: "แต้มของคุณไม่พอสำหรับแลกรายการนี้ค่ะ" }, { status: 400 });
  }

  const code = `REDEEM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  try {
    if (tier.discount_type === "percent") {
      await createPercentDiscountCode({
        title: `Points redemption (${uid.slice(0, 8)}) — ${tier.label_en}`,
        code,
        percentage: tier.discount_value / 100,
        usageLimit: 1,
      });
    } else {
      await createAmountDiscountCode({
        title: `Points redemption (${uid.slice(0, 8)}) — ${tier.label_en}`,
        code,
        amount: tier.discount_value,
        usageLimit: 1,
      });
    }
  } catch (err) {
    console.error("[redeem] discount code creation failed", err);
    return NextResponse.json({ ok: false, error: "สร้างโค้ดส่วนลดไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ" }, { status: 502 });
  }

  await supabaseRest("points_ledger", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: uid,
      delta: -tier.points_cost,
      reason: "redeem",
      shopify_discount_code: code,
      metadata: { tier_id: tier.id, discount_type: tier.discount_type, discount_value: tier.discount_value },
    }),
  });

  const newBalance = await getPointBalance(uid);
  return NextResponse.json({ ok: true, code, tier, pointBalance: newBalance });
}

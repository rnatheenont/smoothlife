import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { createPercentDiscountCode, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { discountForScore, SKIN_COACH_POINTS_REWARD } from "@/lib/skin-coach";

function currentPeriod() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนรับคูปองครับ" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  // Client-reported scan score, used only to pick a reward tier (5-15%) —
  // not a security boundary, same trust level as the rest of this perk.
  const score = typeof body?.score === "number" ? body.score : 0;
  const { percentage, label } = discountForScore(score);
  const method: "coupon" | "points" = body?.method === "points" ? "points" : "coupon";

  const period = currentPeriod();

  const existing = await supabaseRest<{ shopify_discount_code: string | null; reward_type: string }[]>(
    `skin_coach_rewards?user_id=eq.${uid}&period=eq.${period}&select=shopify_discount_code,reward_type`
  );
  if (existing.length > 0) {
    return NextResponse.json({
      ok: true,
      code: existing[0].shopify_discount_code,
      rewardType: existing[0].reward_type,
      points: SKIN_COACH_POINTS_REWARD,
      alreadyClaimed: true,
      label,
    });
  }

  if (method === "points") {
    const inserted = await supabaseRest<{ id: string }[]>("skin_coach_rewards?on_conflict=user_id,period", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ user_id: uid, period, reward_type: "points" }),
    });

    // Same rare-race handling as the coupon path below: another request won
    // the insert first, so don't double-credit points.
    if (inserted.length === 0) {
      return NextResponse.json({ ok: true, points: SKIN_COACH_POINTS_REWARD, rewardType: "points", alreadyClaimed: true, label });
    }

    await supabaseRest("points_ledger", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: uid,
        delta: SKIN_COACH_POINTS_REWARD,
        reason: "skin_coach_points",
        metadata: { period },
      }),
    });

    return NextResponse.json({ ok: true, points: SKIN_COACH_POINTS_REWARD, rewardType: "points", label });
  }

  if (!shopifyAdminConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "ยังไม่ได้ตั้งค่าระบบออกคูปองอัตโนมัติ กรุณาติดต่อผู้ดูแลระบบ (SHOPIFY_ADMIN_CLIENT_ID / SHOPIFY_ADMIN_CLIENT_SECRET)",
      },
      { status: 200 }
    );
  }

  try {
    const code = `SKINCOACH-${randomSuffix()}`;
    await createPercentDiscountCode({
      title: `Skin Coach reward ${period} (${uid.slice(0, 8)}, ${label})`,
      code,
      percentage,
      usageLimit: 1,
    });

    const inserted = await supabaseRest<{ shopify_discount_code: string }[]>(
      "skin_coach_rewards?on_conflict=user_id,period",
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ user_id: uid, period, shopify_discount_code: code, reward_type: "coupon" }),
      }
    );

    // Extremely rare race: another request won the insert first — return
    // that one instead of a code nobody's row points to.
    if (inserted.length === 0) {
      const row = await supabaseRest<{ shopify_discount_code: string }[]>(
        `skin_coach_rewards?user_id=eq.${uid}&period=eq.${period}&select=shopify_discount_code`
      );
      return NextResponse.json({ ok: true, code: row[0]?.shopify_discount_code ?? code, rewardType: "coupon", alreadyClaimed: true, label });
    }

    return NextResponse.json({ ok: true, code, rewardType: "coupon", label });
  } catch (err) {
    console.error("[skin-coach claim-reward]", err);
    return NextResponse.json(
      { ok: false, error: "ขออภัยครับ ออกคูปองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 200 }
    );
  }
}

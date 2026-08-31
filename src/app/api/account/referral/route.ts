import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCustomerOrders, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { generateReferralCode } from "@/lib/referral";
import { REFERRER_ACTIVE_MONTHS } from "@/lib/referral-shared";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.smoothlife.com";

export type ReferralHistoryRow = {
  id: string;
  status: string;
  order_amount: number | null;
  link_clicked_at: string | null;
  delivered_at: string | null;
  reward_release_at: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }

  let [user] = await supabaseRest<{ referral_code: string | null; shopify_customer_id: string | null }[]>(
    `users?id=eq.${uid}&select=referral_code,shopify_customer_id`
  );

  if (!user?.referral_code) {
    // Generated lazily on first visit to the referral page rather than at
    // signup — most users never share a link, so most accounts never need
    // one. Retries once on the rare unique-collision.
    for (let attempt = 0; attempt < 2; attempt++) {
      const candidate = generateReferralCode();
      try {
        const [updated] = await supabaseRest<{ referral_code: string | null; shopify_customer_id: string | null }[]>(
          `users?id=eq.${uid}`,
          { method: "PATCH", body: JSON.stringify({ referral_code: candidate }) }
        );
        user = updated;
        break;
      } catch {
        if (attempt === 1) throw new Error("ไม่สามารถสร้างโค้ดแนะนำเพื่อนได้ กรุณาลองใหม่อีกครั้ง");
      }
    }
  }

  let eligible = false;
  if (user?.shopify_customer_id && shopifyAdminConfigured()) {
    const orders = await getCustomerOrders(user.shopify_customer_id, 20);
    const cutoff = Date.now() - REFERRER_ACTIVE_MONTHS * 30 * 86_400_000;
    eligible = Boolean(orders?.some((o) => o.financialStatus === "PAID" && new Date(o.createdAt).getTime() >= cutoff));
  }

  const referrals = await supabaseRest<ReferralHistoryRow[]>(
    `referrals?referrer_user_id=eq.${uid}&select=id,status,order_amount,link_clicked_at,delivered_at,reward_release_at,created_at&order=created_at.desc&limit=50`
  );

  return NextResponse.json({
    ok: true,
    referralCode: user?.referral_code ?? null,
    shareUrl: user?.referral_code ? `${SITE_URL}/r/${user.referral_code}` : null,
    eligible,
    referrals,
  });
}

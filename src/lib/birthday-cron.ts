import { supabaseRest } from "@/lib/supabase-server";
import { getCustomerOrders, createPercentDiscountCode, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { getUserLoyalty } from "@/lib/user-tier";
import { generateDiscountCode } from "@/lib/referral";
import { TierName } from "@/lib/loyalty-shared";

// Per the loyalty plan doc section 2: Bronze gets a flat points bonus,
// Silver/Gold get a birthday discount + points. The doc phrases Silver/Gold
// as "2x/3x points" without saying 2x/3x *of what* — read here as 2x/3x
// Bronze's flat 100, since nothing ties a birthday event to a specific
// order to multiply against. Flag this reading if it's wrong.
//
// Bronze's GWP (physical birthday gift) is explicitly left unresolved in
// the plan doc ("ของขวัญวันเกิด GWP คือของจริงต้องจัดส่งไหม หรือคูปอง/สิทธิ์ในระบบ" —
// open question) — not implemented here rather than inventing a product/
// shipping mechanism that was never specified.
const BIRTHDAY_REWARDS: Record<TierName, { points: number; discountPct: number | null }> = {
  Bronze: { points: 100, discountPct: null },
  Silver: { points: 200, discountPct: 10 },
  Gold: { points: 300, discountPct: 20 },
};

function isBirthdayToday(birthdate: string, today: Date): boolean {
  const d = new Date(birthdate);
  return d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
}

export async function awardBirthdayRewards(): Promise<{ awarded: number; skippedNoPriorOrder: number }> {
  const today = new Date();
  const users = await supabaseRest<{ id: string; birthdate: string; shopify_customer_id: string | null }[]>(
    `users?birthdate=not.is.null&select=id,birthdate,shopify_customer_id`
  );
  const birthdayUsers = users.filter((u) => isBirthdayToday(u.birthdate, today));

  let awarded = 0;
  let skippedNoPriorOrder = 0;
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1)).toISOString();

  for (const u of birthdayUsers) {
    // One birthday reward per calendar year — cheap to check even when the
    // cron runs more than once on the same day.
    const already = await supabaseRest<{ id: string }[]>(
      `points_ledger?user_id=eq.${u.id}&reason=eq.birthday_bonus&created_at=gte.${yearStart}&select=id&limit=1`
    );
    if (already.length) continue;

    // "วันเกิด Tier 1 ต้องมีประวัติซื้อ 1 ครั้งก่อนถึงได้สิทธิ์" — applies at
    // every tier here, not just Bronze: you can't reach Silver/Gold without
    // real order history anyway, so this only ever actually filters Bronze.
    let hasPriorOrder = false;
    if (u.shopify_customer_id && shopifyAdminConfigured()) {
      const orders = await getCustomerOrders(u.shopify_customer_id, 5);
      hasPriorOrder = Boolean(orders?.some((o) => o.financialStatus === "PAID"));
    }
    if (!hasPriorOrder) {
      skippedNoPriorOrder++;
      continue;
    }

    const loyalty = await getUserLoyalty(u.id);
    const reward = BIRTHDAY_REWARDS[loyalty.tier];

    await supabaseRest("points_ledger", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: u.id,
        delta: reward.points,
        reason: "birthday_bonus",
        metadata: { tier: loyalty.tier, year: today.getUTCFullYear() },
      }),
    });

    let discountCode: string | null = null;
    if (reward.discountPct && shopifyAdminConfigured()) {
      const code = generateDiscountCode("SLBDAY");
      try {
        await createPercentDiscountCode({
          title: `Birthday ${loyalty.tier} — ${u.id}`,
          code,
          percentage: reward.discountPct / 100,
          usageLimit: 1,
        });
        discountCode = code;
      } catch (err) {
        console.error("[birthday-cron] failed to create birthday discount code", u.id, err);
      }
    }

    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: u.id,
        type: "birthday_bonus",
        title: "สุขสันต์วันเกิดค่ะ!",
        body: discountCode
          ? `รับ ${reward.points} คะแนน และส่วนลด ${reward.discountPct}% โค้ด ${discountCode}`
          : `รับ ${reward.points} คะแนนพิเศษวันเกิดค่ะ`,
        link: "/account/points",
        metadata: { tier: loyalty.tier, discountCode },
      }),
    });

    awarded++;
  }

  return { awarded, skippedNoPriorOrder };
}

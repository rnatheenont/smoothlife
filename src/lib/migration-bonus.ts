import { supabaseRest } from "@/lib/supabase-server";
import { getCustomerOrders } from "@/lib/shopify-admin";
import { PLACEHOLDER_NAME } from "@/lib/link-shopify-customer";

// One-time 500pt bonus for accounts that existed as real customers before
// this membership system — per the loyalty plan doc section 1.3, awarded
// automatically once verification is complete (name + phone + email all
// on file), not a self-claim. "Existing customer" is proven by at least
// one real paid Shopify order, not just having a linked customer record
// (which could exist from e.g. a newsletter signup with no purchase) —
// same anti-abuse bar as the review/referral genuinely-new-customer checks
// elsewhere in this app. Reuses the 'legacy_verify_bonus' ledger reason
// from the original (100pt, manual self-claim) implementation of this
// feature rather than introducing a second reason code for the same bonus.
const MIGRATION_BONUS_POINTS = 500;

export async function maybeAwardMigrationBonus(userId: string): Promise<{ awarded: boolean }> {
  const [user] = await supabaseRest<
    { display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]
  >(`users?id=eq.${userId}&select=display_name,phone,shopify_customer_id`);
  if (!user || !user.phone || !user.shopify_customer_id) return { awarded: false };
  if (!user.display_name || user.display_name === PLACEHOLDER_NAME) return { awarded: false };

  const [emailIdentity] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${userId}&provider=eq.email&select=provider_uid&limit=1`
  );
  if (!emailIdentity) return { awarded: false };

  const alreadyAwarded = await supabaseRest<{ id: string }[]>(
    `points_ledger?user_id=eq.${userId}&reason=eq.legacy_verify_bonus&select=id&limit=1`
  );
  if (alreadyAwarded.length) return { awarded: false };

  const orders = await getCustomerOrders(user.shopify_customer_id, 5);
  const hasRealOrder = Boolean(orders?.some((o) => o.financialStatus === "PAID"));
  if (!hasRealOrder) return { awarded: false };

  await supabaseRest("points_ledger", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: userId,
      delta: MIGRATION_BONUS_POINTS,
      reason: "legacy_verify_bonus",
      metadata: { note: "auto-awarded on profile completion" },
    }),
  });
  await supabaseRest("notifications", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: userId,
      type: "migration_bonus",
      title: "ยินดีต้อนรับสมาชิกเดิม!",
      body: `รับ ${MIGRATION_BONUS_POINTS} คะแนนพิเศษ เมื่อยืนยันข้อมูลบัญชีครบถ้วน`,
      link: "/account/points",
    }),
  });
  return { awarded: true };
}

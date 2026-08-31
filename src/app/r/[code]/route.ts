import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getCustomerOrders, createAmountDiscountCode, shopifyAdminConfigured } from "@/lib/shopify-admin";
import {
  REFERRAL_COOKIE,
  REFEREE_DISCOUNT_AMOUNT,
  REFEREE_MIN_SUBTOTAL,
  REFERRAL_LINK_WINDOW_DAYS,
  REFERRER_ACTIVE_MONTHS,
  referralCookieOptions,
} from "@/lib/referral-shared";
import { generateDiscountCode } from "@/lib/referral";

// A friend's entry point into the referral programme: /r/CODE. Always lands
// on the homepage — an unknown code, an ineligible referrer, or any lookup
// failure just falls through to a plain homepage visit rather than showing
// an error, since this URL is meant to be shared casually in chat apps.
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const home = () => NextResponse.redirect(new URL("/", req.url));
  const code = params.code?.trim().toUpperCase();
  if (!code || !supabaseConfigured()) return home();

  // Already carrying a referral cookie — don't overwrite an in-progress one
  // or spend another Shopify API call creating a duplicate discount code.
  if (req.cookies.get(REFERRAL_COOKIE)?.value) return home();

  const [referrer] = await supabaseRest<{ id: string; shopify_customer_id: string | null }[]>(
    `users?referral_code=eq.${encodeURIComponent(code)}&select=id,shopify_customer_id`
  );
  if (!referrer) return home();

  // Eligibility per the plan: a referrer needs a real order within the last
  // N months to have a working link at all — checked here (link use), not
  // deferred to reward release.
  if (!referrer.shopify_customer_id || !shopifyAdminConfigured()) return home();
  const orders = await getCustomerOrders(referrer.shopify_customer_id, 20);
  const cutoff = Date.now() - REFERRER_ACTIVE_MONTHS * 30 * 86_400_000;
  const referrerActive = Boolean(
    orders?.some((o) => o.financialStatus === "PAID" && new Date(o.createdAt).getTime() >= cutoff)
  );
  if (!referrerActive) return home();

  const expiresAt = new Date(Date.now() + REFERRAL_LINK_WINDOW_DAYS * 86_400_000);
  const discountCode = generateDiscountCode("SLFRIEND");
  try {
    await createAmountDiscountCode({
      title: `Referral welcome — ${code}`,
      code: discountCode,
      amount: REFEREE_DISCOUNT_AMOUNT,
      minSubtotal: REFEREE_MIN_SUBTOTAL,
      usageLimit: 1,
    });
  } catch (err) {
    console.error("[referral] failed to create welcome discount code", err);
    return home();
  }

  const [row] = await supabaseRest<{ id: string }[]>("referrals", {
    method: "POST",
    body: JSON.stringify({
      referrer_user_id: referrer.id,
      referral_code: code,
      link_clicked_at: new Date().toISOString(),
      discount_expires_at: expiresAt.toISOString(),
      referee_discount_code: discountCode,
      status: "link_clicked",
    }),
  });
  if (!row) return home();

  const res = home();
  res.cookies.set(
    REFERRAL_COOKIE,
    JSON.stringify({ referralId: row.id, code, discountCode, expiresAt: expiresAt.toISOString() }),
    referralCookieOptions(expiresAt)
  );
  return res;
}

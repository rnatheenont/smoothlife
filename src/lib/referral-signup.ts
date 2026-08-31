import { NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase-server";
import { getCustomerOrders } from "@/lib/shopify-admin";
import { REFERRAL_COOKIE, parseReferralCookie } from "@/lib/referral-shared";

// Shared by every signup entry point that can create a brand-new account
// (email+password register, phone OTP, email OTP) — attributes the signup
// to whoever's referral link brought them here. One-time: only ever
// matches a row still sitting at 'link_clicked'. Only counts a genuinely
// new customer (no prior paid order under the Shopify identity we just
// linked/matched), per the plan's anti-abuse rule. The referral cookie
// itself is left alone — it still needs to drive the friend's ฿100
// checkout discount after this.
export async function attributeReferralSignup(
  req: NextRequest,
  opts: { newUserId: string; isNewAccount: boolean; shopifyCustomerId: string | null }
): Promise<void> {
  if (!opts.isNewAccount) return;
  const referralCookie = parseReferralCookie(req.cookies.get(REFERRAL_COOKIE)?.value);
  if (!referralCookie) return;

  try {
    let genuinelyNew = true;
    if (opts.shopifyCustomerId) {
      const priorOrders = await getCustomerOrders(opts.shopifyCustomerId, 5);
      genuinelyNew = !priorOrders?.some((o) => o.financialStatus === "PAID");
    }
    if (genuinelyNew) {
      await supabaseRest(`referrals?id=eq.${referralCookie.referralId}&status=eq.link_clicked`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ referred_user_id: opts.newUserId, status: "registered" }),
      });
    }
  } catch (err) {
    console.error("[referral] signup linking failed", err);
  }
}

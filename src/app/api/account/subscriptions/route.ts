import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { twoC2PConfigured } from "@/lib/2c2p";

export type SubscriptionRow = {
  id: string;
  shopify_order_id: string;
  shopify_order_name: string | null;
  product_slug: string;
  product_name: string;
  variant_id: string;
  plan_months: 3 | 6 | 12;
  plan_code: string;
  price_per_cycle: number;
  purchased_at: string;
  next_renewal_at: string;
  active: boolean;
  reminded_at: string | null;
};

export type RealSubscriptionRow = {
  id: string;
  status: "pending" | "active" | "past_due" | "cancelled" | "completed" | "ended";
  subscription_type: "single_product" | "set" | "custom_bundle";
  product_name: string;
  product_slug: string | null;
  set_slug: string | null;
  plan_months: 3 | 6 | 12;
  discount_pct: number;
  amount_per_cycle: number;
  currency_code: string;
  current_term_number: number;
  cycle_in_term: number;
  auto_renew_cancelled: boolean;
  next_charge_date: string | null;
};

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ loggedIn: false });
  }
  const [subscriptions, realSubscriptions] = await Promise.all([
    supabaseRest<SubscriptionRow[]>(
      `subscription_preferences?user_id=eq.${uid}&select=id,shopify_order_id,shopify_order_name,product_slug,product_name,variant_id,plan_months,plan_code,price_per_cycle,purchased_at,next_renewal_at,active,reminded_at&order=next_renewal_at.asc`
    ),
    supabaseRest<RealSubscriptionRow[]>(
      `real_subscriptions?user_id=eq.${uid}&status=neq.pending&select=id,status,subscription_type,product_name,product_slug,set_slug,plan_months,discount_pct,amount_per_cycle,currency_code,current_term_number,cycle_in_term,auto_renew_cancelled,next_charge_date&order=created_at.desc`
    ),
  ]);
  return NextResponse.json({ loggedIn: true, subscriptions, realSubscriptions, billingEnabled: twoC2PConfigured() });
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

type SubscriptionRow = {
  id: string;
  status: "pending" | "active" | "past_due" | "cancelled" | "completed" | "ended";
  subscription_type: "single_product" | "set" | "custom_bundle";
  product_name: string;
  amount_per_cycle: number;
  plan_months: number;
  contact_email: string | null;
  contact_phone: string | null;
  next_charge_date: string | null;
  recurring_unique_id: string | null;
  created_at: string;
};

type ChargeRow = {
  id: string;
  cycle_number: number;
  amount: number;
  success: boolean | null;
  shopify_order_id: string | null;
  charged_at: string | null;
  created_at: string;
  refunded_at: string | null;
  refund_note: string | null;
  real_subscriptions: { product_name: string; subscription_type: string; user_id: string } | null;
};

// Small-scale aggregation done in-memory (subscriber counts for a single
// store are realistically in the hundreds/low-thousands, not millions) —
// simpler and more transparent than trying to push GROUP BY through
// PostgREST's REST surface for a page that only staff ever load.
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [subscriptions, recentCharges] = await Promise.all([
    supabaseRest<SubscriptionRow[]>(
      "real_subscriptions?select=id,status,subscription_type,product_name,amount_per_cycle,plan_months,contact_email,contact_phone,next_charge_date,recurring_unique_id,created_at&order=created_at.desc"
    ),
    // Embeds via the FK to real_subscriptions so each charge carries its
    // product name/type without a second round trip per row.
    supabaseRest<ChargeRow[]>(
      "real_subscription_charges?select=id,cycle_number,amount,success,shopify_order_id,charged_at,created_at,refunded_at,refund_note,real_subscriptions(product_name,subscription_type,user_id)&order=created_at.desc&limit=50"
    ),
  ]);

  const byStatus: Record<string, number> = {};
  for (const s of subscriptions) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

  const activeSubs = subscriptions.filter((s) => s.status === "active");
  const mrr = activeSubs.reduce((sum, s) => sum + s.amount_per_cycle, 0);

  const byType: Record<string, { count: number; mrr: number }> = {};
  for (const s of activeSubs) {
    const key = s.subscription_type;
    if (!byType[key]) byType[key] = { count: 0, mrr: 0 };
    byType[key].count += 1;
    byType[key].mrr += s.amount_per_cycle;
  }

  const needsAttention = subscriptions
    .filter((s) => s.status === "past_due")
    .map((s) => ({
      id: s.id,
      productName: s.product_name,
      amountPerCycle: s.amount_per_cycle,
      contactEmail: s.contact_email,
      contactPhone: s.contact_phone,
      nextChargeDate: s.next_charge_date,
      recurringUniqueId: s.recurring_unique_id,
    }));

  // A charge 2C2P confirmed as successful but that never produced a
  // Shopify order — the customer was charged and is owed a shipment that
  // nothing is currently tracking. See the "silent failure" risk flagged
  // when this dashboard was requested — this is exactly what surfaces it.
  const chargedNoOrder = recentCharges
    .filter((c) => c.success === true && !c.shopify_order_id)
    .map((c) => ({
      id: c.id,
      cycleNumber: c.cycle_number,
      amount: c.amount,
      chargedAt: c.charged_at,
      productName: c.real_subscriptions?.product_name ?? "ไม่ทราบ",
    }));

  const recent = recentCharges.slice(0, 30).map((c) => ({
    id: c.id,
    cycleNumber: c.cycle_number,
    amount: c.amount,
    success: c.success,
    shopifyOrderId: c.shopify_order_id,
    chargedAt: c.charged_at,
    productName: c.real_subscriptions?.product_name ?? "ไม่ทราบ",
    subscriptionType: c.real_subscriptions?.subscription_type ?? null,
    refundedAt: c.refunded_at,
    refundNote: c.refund_note,
  }));

  return NextResponse.json({
    ok: true,
    byStatus,
    mrr,
    byType,
    needsAttention,
    chargedNoOrder,
    recentCharges: recent,
  });
}

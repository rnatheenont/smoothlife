import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";

type ChargeHistoryRow = {
  id: string;
  cycle_number: number;
  amount: number;
  success: boolean | null;
  charged_at: string | null;
  shopify_order_id: string | null;
};

type ShipmentHistoryRow = {
  id: string;
  term_number: number;
  cycle_in_term: number;
  shopify_order_id: string;
  shipped_at: string;
};

// Charge + shipment ledgers for one subscription — written by the 2C2P
// webhook on every cycle but never surfaced anywhere until now (account
// page only ever showed current status, not history).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }

  const [subscription] = await supabaseRest<{ id: string }[]>(
    `real_subscriptions?id=eq.${params.id}&user_id=eq.${uid}&select=id`
  );
  if (!subscription) return NextResponse.json({ ok: false, error: "ไม่พบรายการสมัครนี้" }, { status: 404 });

  const [charges, shipments] = await Promise.all([
    supabaseRest<ChargeHistoryRow[]>(
      `real_subscription_charges?subscription_id=eq.${params.id}&select=id,cycle_number,amount,success,charged_at,shopify_order_id&order=cycle_number.desc`
    ),
    supabaseRest<ShipmentHistoryRow[]>(
      `subscription_shipments?subscription_id=eq.${params.id}&select=id,term_number,cycle_in_term,shopify_order_id,shipped_at&order=shipped_at.desc`
    ),
  ]);

  return NextResponse.json({ ok: true, charges, shipments });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

type UserRow = { id: string; display_name: string | null; phone: string | null; shopify_customer_id: string | null };
type BalanceRow = { user_id: string; balance: number };
type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  shopify_order_id: string | null;
  shopify_discount_code: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [[user], [balanceRow], ledger] = await Promise.all([
    supabaseRest<UserRow[]>(`users?id=eq.${params.id}&select=id,display_name,phone,shopify_customer_id`),
    supabaseRest<BalanceRow[]>(`points_balance?user_id=eq.${params.id}&select=user_id,balance`),
    supabaseRest<LedgerRow[]>(
      `points_ledger?user_id=eq.${params.id}&select=id,delta,reason,shopify_order_id,shopify_discount_code,metadata,created_at&order=created_at.desc&limit=20`
    ),
  ]);

  if (!user) return NextResponse.json({ ok: false, error: "ไม่พบลูกค้ารายนี้" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    customer: {
      id: user.id,
      displayName: user.display_name,
      phone: user.phone,
      balance: balanceRow?.balance ?? 0,
    },
    ledger,
  });
}

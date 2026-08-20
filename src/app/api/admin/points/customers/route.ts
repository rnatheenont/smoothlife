import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

type UserRow = { id: string; display_name: string | null; phone: string | null; shopify_customer_id: string | null };
type IdentityRow = { user_id: string; provider: string; provider_uid: string };
type BalanceRow = { user_id: string; balance: number };

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ ok: true, customers: [] });

  const wildcard = encodeURIComponent(`*${q}*`);
  const [byName, byPhone, byIdentity] = await Promise.all([
    supabaseRest<UserRow[]>(`users?display_name=ilike.${wildcard}&select=id&limit=20`),
    supabaseRest<UserRow[]>(`users?phone=ilike.${wildcard}&select=id&limit=20`),
    supabaseRest<IdentityRow[]>(`auth_identities?provider_uid=ilike.${wildcard}&select=user_id&limit=20`),
  ]);

  const ids = new Set<string>();
  byName.forEach((u) => ids.add(u.id));
  byPhone.forEach((u) => ids.add(u.id));
  byIdentity.forEach((i) => ids.add(i.user_id));
  if (ids.size === 0) return NextResponse.json({ ok: true, customers: [] });

  const idList = [...ids].slice(0, 20).join(",");
  const [users, balances, identities] = await Promise.all([
    supabaseRest<UserRow[]>(`users?id=in.(${idList})&select=id,display_name,phone,shopify_customer_id`),
    supabaseRest<BalanceRow[]>(`points_balance?user_id=in.(${idList})&select=user_id,balance`),
    supabaseRest<IdentityRow[]>(`auth_identities?user_id=in.(${idList})&provider=eq.email&select=user_id,provider,provider_uid`),
  ]);
  const balanceMap = new Map(balances.map((b) => [b.user_id, b.balance]));
  const emailMap = new Map(identities.map((i) => [i.user_id, i.provider_uid]));

  const customers = users.map((u) => ({
    id: u.id,
    displayName: u.display_name,
    phone: u.phone,
    email: emailMap.get(u.id) ?? null,
    balance: balanceMap.get(u.id) ?? 0,
  }));

  return NextResponse.json({ ok: true, customers });
}

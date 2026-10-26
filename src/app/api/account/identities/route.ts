import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { maskIdentity, type ChannelKey } from "@/lib/account-identities";

// What this account can be signed in with, and what it is worth.
//
// The worth is here, next to the channels, because the page's whole job is
// to let somebody recognise their own account — "100 points, member since
// August" is how a shopper tells their two accounts apart, not a uuid.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const [identities, [user], [balance], orders] = await Promise.all([
    supabaseRest<{ provider: string; provider_uid: string; verified_at: string | null }[]>(
      `auth_identities?user_id=eq.${pgValue(uid)}&select=provider,provider_uid,verified_at&order=created_at.asc`,
    ).catch(() => []),
    supabaseRest<{ display_name: string; created_at: string }[]>(
      `users?id=eq.${pgValue(uid)}&select=display_name,created_at`,
    ).catch(() => []),
    supabaseRest<{ balance: number }[]>(
      `points_balance?user_id=eq.${pgValue(uid)}&select=balance`,
    ).catch(() => []),
    supabaseRest<{ id: string }[]>(
      `payment_transactions?user_id=eq.${pgValue(uid)}&status=eq.success&select=id`,
    ).catch(() => []),
  ]);

  if (!user) return NextResponse.json({ ok: false, error: "ไม่พบบัญชี" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    account: {
      name: user.display_name,
      createdAt: user.created_at,
      points: balance?.balance ?? 0,
      orders: orders.length,
    },
    // Masked here rather than on the page: the full address never needs to
    // reach the browser for this screen to do its job.
    identities: identities.map((i) => ({
      provider: i.provider as ChannelKey,
      masked: maskIdentity(i.provider, i.provider_uid),
      verifiedAt: i.verified_at,
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { tierProgress } from "@/data/coupons";

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ user: null });
  }
  const [user] = await supabaseRest<
    { id: string; display_name: string; created_at: string }[]
  >(`users?id=eq.${uid}&select=id,display_name,created_at`);
  if (!user) return NextResponse.json({ user: null });

  const identities = await supabaseRest<{ provider: string; provider_uid: string }[]>(
    `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider,provider_uid`
  );
  const [balanceRow] = await supabaseRest<{ balance: number }[]>(
    `points_balance?user_id=eq.${uid}&select=balance`
  );
  const points = balanceRow?.balance ?? 0;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.display_name,
      email: identities[0]?.provider_uid,
      provider: "email",
      points,
      tier: tierProgress(points).current,
      createdAt: user.created_at,
    },
  });
}

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
    { id: string; display_name: string; created_at: string; phone: string | null; gender: string | null; birthdate: string | null; avatar_url: string | null }[]
  >(`users?id=eq.${uid}&select=id,display_name,created_at,phone,gender,birthdate,avatar_url`);
  if (!user) return NextResponse.json({ user: null });

  // A user can have more than one linked identity (e.g. email + phone_otp
  // from the unified signup flow) — report whichever exists, preferring
  // email as the "provider" label since that's the one with a password
  // fallback, then line, then phone.
  const identities = await supabaseRest<{ provider: string; provider_uid: string }[]>(
    `auth_identities?user_id=eq.${uid}&provider=in.(email,phone_otp,line)&select=provider,provider_uid`
  );
  const emailIdentity = identities.find((i) => i.provider === "email");
  const phoneIdentity = identities.find((i) => i.provider === "phone_otp");
  const lineIdentity = identities.find((i) => i.provider === "line");
  const [balanceRow] = await supabaseRest<{ balance: number }[]>(
    `points_balance?user_id=eq.${uid}&select=balance`
  );
  const points = balanceRow?.balance ?? 0;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.display_name,
      email: emailIdentity?.provider_uid,
      phone: user.phone || phoneIdentity?.provider_uid,
      gender: user.gender,
      birthdate: user.birthdate,
      avatar: user.avatar_url,
      provider: emailIdentity ? "email" : lineIdentity ? "line" : phoneIdentity ? "phone" : "email",
      real: true,
      points,
      tier: tierProgress(points).current,
      createdAt: user.created_at,
    },
  });
}

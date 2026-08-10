import { NextRequest, NextResponse } from "next/server";
import { verifyFirebasePhoneIdToken } from "@/lib/firebase-verify";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { findShopifyCustomerByPhone } from "@/lib/shopify-admin";
import { tierProgress } from "@/data/coupons";

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบบัญชีผู้ใช้ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" }, { status: 503 });
  }
  const { idToken, name } = await req.json().catch(() => ({}));
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const verified = await verifyFirebasePhoneIdToken(idToken);
  if (!verified) {
    return NextResponse.json({ ok: false, error: "ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 401 });
  }

  const result = await supabaseRest<{ user_id: string; created_at: string; is_new: boolean }[]>(
    "rpc/find_or_create_phone_member",
    {
      method: "POST",
      body: JSON.stringify({
        p_phone: verified.phoneNumber,
        p_display_name: typeof name === "string" && name.trim() ? name.trim() : null,
      }),
    }
  );
  const row = result[0];
  if (!row?.user_id) {
    return NextResponse.json({ ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }

  // Best-effort Shopify link, same as the email path — only on first signup.
  if (row.is_new) {
    const shopifyMatch = await findShopifyCustomerByPhone(verified.phoneNumber);
    if (shopifyMatch) {
      try {
        await supabaseRest(`users?id=eq.${row.user_id}`, {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ shopify_customer_id: shopifyMatch.id }),
        });
      } catch (err) {
        console.error("[otp verify] failed to link shopify customer", err);
      }
    }
  }

  const [user] = await supabaseRest<
    { id: string; display_name: string; created_at: string; gender: string | null; birthdate: string | null; avatar_url: string | null }[]
  >(`users?id=eq.${row.user_id}&select=id,display_name,created_at,gender,birthdate,avatar_url`);
  const [balanceRow] = await supabaseRest<{ balance: number }[]>(
    `points_balance?user_id=eq.${row.user_id}&select=balance`
  );
  const points = balanceRow?.balance ?? 0;

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.display_name,
      phone: verified.phoneNumber,
      gender: user.gender,
      birthdate: user.birthdate,
      avatar: user.avatar_url,
      provider: "phone",
      real: true,
      points,
      tier: tierProgress(points).current,
      createdAt: user.created_at,
    },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(row.user_id), sessionCookieOptions);
  return res;
}

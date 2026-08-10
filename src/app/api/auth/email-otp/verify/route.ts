import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { findShopifyCustomerByEmail } from "@/lib/shopify-admin";
import { tierProgress } from "@/data/coupons";

const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบบัญชีผู้ใช้ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" }, { status: 503 });
  }
  const { email, code, name } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof code !== "string") {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const [challenge] = await supabaseRest<
    { id: string; code_hash: string; expires_at: string; attempt_count: number }[]
  >(
    `otp_challenges?provider=eq.email&target=eq.${encodeURIComponent(normalizedEmail)}&consumed_at=is.null&order=created_at.desc&limit=1&select=id,code_hash,expires_at,attempt_count`
  );
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "รหัสหมดอายุ กรุณาขอรหัสใหม่" }, { status: 401 });
  }
  if (challenge.attempt_count >= MAX_ATTEMPTS) {
    return NextResponse.json({ ok: false, error: "กรอกรหัสผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่" }, { status: 429 });
  }
  if (challenge.code_hash !== hashCode(code.trim())) {
    await supabaseRest(`otp_challenges?id=eq.${challenge.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ attempt_count: challenge.attempt_count + 1 }),
    });
    return NextResponse.json({ ok: false, error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  }
  await supabaseRest(`otp_challenges?id=eq.${challenge.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });

  const result = await supabaseRest<{ user_id: string; created_at: string; is_new: boolean }[]>(
    "rpc/find_or_create_email_member",
    {
      method: "POST",
      body: JSON.stringify({
        p_email: normalizedEmail,
        p_display_name: typeof name === "string" && name.trim() ? name.trim() : null,
      }),
    }
  );
  const row = result[0];
  if (!row?.user_id) {
    return NextResponse.json({ ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }

  if (row.is_new) {
    const shopifyMatch = await findShopifyCustomerByEmail(normalizedEmail);
    if (shopifyMatch) {
      try {
        await supabaseRest(`users?id=eq.${row.user_id}`, {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ shopify_customer_id: shopifyMatch.id, phone: shopifyMatch.phone || undefined }),
        });
      } catch (err) {
        console.error("[email-otp verify] failed to link shopify customer", err);
      }
    }
  }

  const [user] = await supabaseRest<
    { id: string; display_name: string; created_at: string; phone: string | null; gender: string | null; birthdate: string | null; avatar_url: string | null }[]
  >(`users?id=eq.${row.user_id}&select=id,display_name,created_at,phone,gender,birthdate,avatar_url`);
  const [balanceRow] = await supabaseRest<{ balance: number }[]>(
    `points_balance?user_id=eq.${row.user_id}&select=balance`
  );
  const points = balanceRow?.balance ?? 0;

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.display_name,
      email: normalizedEmail,
      phone: user.phone,
      gender: user.gender,
      birthdate: user.birthdate,
      avatar: user.avatar_url,
      provider: "email",
      real: true,
      points,
      tier: tierProgress(points).current,
      createdAt: user.created_at,
    },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(row.user_id), sessionCookieOptions);
  return res;
}

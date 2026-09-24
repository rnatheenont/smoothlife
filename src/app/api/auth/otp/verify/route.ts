import { NextRequest, NextResponse } from "next/server";
import { verifyFirebasePhoneIdToken } from "@/lib/firebase-verify";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { ensureShopifyLink } from "@/lib/link-shopify-customer";
import { getUserLoyalty } from "@/lib/user-tier";
import { attributeReferralSignup } from "@/lib/referral-signup";

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

  let [user] = await supabaseRest<
    {
      id: string;
      display_name: string;
      created_at: string;
      gender: string | null;
      birthdate: string | null;
      avatar_url: string | null;
      shopify_customer_id: string | null;
    }[]
  >(`users?id=eq.${row.user_id}&select=id,display_name,created_at,gender,birthdate,avatar_url,shopify_customer_id`);

  // Best-effort: link/create on Shopify — only bother once, same backfill
  // guard as the email/login paths.
  let userId = row.user_id;
  let isNew = row.is_new;
  let displayName = user.display_name;
  let addressSuggestion = null;
  let shopifyCustomerId = user.shopify_customer_id;
  {
    const shopifyLink = await ensureShopifyLink(row.user_id, {
      phone: verified.phoneNumber,
      currentShopifyCustomerId: user.shopify_customer_id,
      currentDisplayName: user.display_name,
      currentPhone: verified.phoneNumber,
    });
    if (shopifyLink.displayName) displayName = shopifyLink.displayName;
    addressSuggestion = shopifyLink.addressSuggestion;
    shopifyCustomerId = shopifyLink.shopifyCustomerId;

    // They already have an account here; they just signed in a way it had
    // never seen. find_or_create_phone_member only looks for the phone among
    // auth_identities, so a number it has not met before always makes a new
    // account — and then the Shopify lookup finds the customer record their
    // real account already owns. Left alone that is two accounts for one
    // person: the same orders on both (the list is read from Shopify), and
    // the points, addresses and flash-sale place in line on whichever they
    // happened to sign in with.
    //
    // A phone proved by OTP that matches the phone on the Shopify record is
    // the same proof account-match.ts already accepts for linking, so the
    // account seconds old is folded into the real one and they arrive where
    // their history is. Only ever the brand-new one — two established
    // accounts are a decision for staff, with a reason written down.
    if (isNew && shopifyLink.takenByUserId && shopifyLink.takenByUserId !== row.user_id) {
      try {
        // The welcome bonus is for new members. This is not one, and it is
        // everything the seconds-old account holds.
        await supabaseRest(`points_ledger?user_id=eq.${row.user_id}`, { method: "DELETE", returning: false });
        await supabaseRest("rpc/merge_web_accounts", {
          method: "POST",
          body: JSON.stringify({ p_survivor: shopifyLink.takenByUserId, p_loser: row.user_id }),
        });
        userId = shopifyLink.takenByUserId;
        isNew = false;
        const [survivor] = await supabaseRest<typeof user[]>(
          `users?id=eq.${userId}&select=id,display_name,created_at,gender,birthdate,avatar_url,shopify_customer_id`
        );
        if (survivor) {
          user = survivor;
          displayName = survivor.display_name;
          shopifyCustomerId = survivor.shopify_customer_id;
          addressSuggestion = null;
        }
      } catch (err) {
        // Signing them into the new, empty account is still better than
        // refusing the login; staff can merge it afterwards.
        console.error("[auth/otp] could not fold new phone account into existing one", err);
      }
    }
  }

  await attributeReferralSignup(req, {
    newUserId: userId,
    isNewAccount: isNew,
    shopifyCustomerId,
  });

  const [balanceRow] = await supabaseRest<{ balance: number }[]>(
    `points_balance?user_id=eq.${userId}&select=balance`
  );
  const points = balanceRow?.balance ?? 0;
  const loyalty = await getUserLoyalty(userId);

  const res = NextResponse.json({
    ok: true,
    isNew,
    user: {
      id: user.id,
      name: displayName,
      phone: verified.phoneNumber,
      gender: user.gender,
      birthdate: user.birthdate,
      avatar: user.avatar_url,
      provider: "phone",
      real: true,
      points,
      tier: loyalty.tier,
      tierSpend: loyalty.spend,
      tierOrders: loyalty.orders,
      createdAt: user.created_at,
      shopifyAddressSuggestion: addressSuggestion,
    },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), sessionCookieOptions);
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import { verifyLiffIdToken, liffConfigured } from "@/lib/line-liff-verify";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";

// Bridges a LIFF ID token into the same session cookie every other login
// path produces, so once this succeeds every existing page (chat widget,
// /account/*) just works inside the LIFF webview unmodified — same
// find_or_create_line_member RPC as the LINE Login OAuth callback, so a
// customer who already linked LINE on the web lands on the same account.
export async function POST(req: NextRequest) {
  if (!liffConfigured() || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 200 });
  }

  const { idToken } = await req.json().catch(() => ({ idToken: null }));
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ ok: false, error: "missing_id_token" }, { status: 400 });
  }

  const profile = await verifyLiffIdToken(idToken);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "invalid_id_token" }, { status: 401 });
  }

  try {
    const result = await supabaseRest<{ user_id: string; is_new: boolean }[]>("rpc/find_or_create_line_member", {
      method: "POST",
      body: JSON.stringify({
        p_line_user_id: profile.userId,
        p_display_name: profile.displayName,
        p_avatar_url: profile.pictureUrl,
      }),
    });
    const userId = result[0]?.user_id;
    const isNew = result[0]?.is_new ?? false;
    if (!userId) throw new Error("no user_id returned from find_or_create_line_member");

    const [user] = await supabaseRest<
      { display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]
    >(`users?id=eq.${userId}&select=display_name,phone,shopify_customer_id`);
    if (user && !user.shopify_customer_id) {
      await linkOrCreateShopifyCustomer(userId, {
        currentDisplayName: user.display_name,
        currentPhone: user.phone,
      });
    }

    const res = NextResponse.json({ ok: true, isNew });
    res.cookies.set(SESSION_COOKIE, createSessionToken(userId), sessionCookieOptions);
    return res;
  } catch (err) {
    console.error("[liff session]", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

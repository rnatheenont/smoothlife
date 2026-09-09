import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { searchShopifyCustomers, shopifyAdminConfigured } from "@/lib/shopify-admin";

// Support search: one term, both sides of the join.
//
// A customer who bought as a guest, then signed up with a different email, ends
// up as a site account pointing at an empty Shopify record while their order
// history sits under the old one. Until now the only way to fix that was for
// someone to edit the database by hand, so it had to go through a developer —
// which is why this screen exists.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  shopify_customer_id: string | null;
  created_at: string;
};

type IdentityRow = { user_id: string; provider: string; provider_uid: string; verified_at: string | null };

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const term = (req.nextUrl.searchParams.get("q") || "").trim();
  if (term.length < 3) {
    return NextResponse.json({ ok: false, error: "พิมพ์อย่างน้อย 3 ตัวอักษร" }, { status: 400 });
  }

  // Thai numbers are stored as typed (081...) on our side and E.164 (+6681...)
  // in Shopify, so a search for one has to look for the other or half the
  // matches are invisible — which is exactly when someone concludes there is
  // no Shopify record and creates a second one.
  const digits = term.replace(/[^\d+]/g, "");
  const phoneForms = new Set<string>();
  if (digits.length >= 9) {
    const local = digits.replace(/^\+?66/, "0").replace(/^0?/, "0");
    phoneForms.add(local);
    phoneForms.add(`+66${local.slice(1)}`);
    phoneForms.add(`66${local.slice(1)}`);
  }

  const like = `*${term}*`;
  const [identities, byName] = await Promise.all([
    supabaseRest<IdentityRow[]>(
      `auth_identities?select=user_id,provider,provider_uid,verified_at&provider_uid=ilike.${encodeURIComponent(like)}&limit=25`
    ).catch(() => []),
    supabaseRest<UserRow[]>(
      `users?select=id,display_name,phone,shopify_customer_id,created_at&or=(display_name.ilike.${encodeURIComponent(
        like
      )}${[...phoneForms].map((p) => `,phone.eq.${pgValue(p)}`).join("")})&limit=25`
    ).catch(() => []),
  ]);

  const ids = new Set<string>([...identities.map((i) => i.user_id), ...byName.map((u) => u.id)]);
  let accounts: UserRow[] = [];
  let allIdentities: IdentityRow[] = [];
  if (ids.size > 0) {
    const list = [...ids].map((id) => `"${id}"`).join(",");
    [accounts, allIdentities] = await Promise.all([
      supabaseRest<UserRow[]>(
        `users?select=id,display_name,phone,shopify_customer_id,created_at&id=in.(${encodeURIComponent(list)})&limit=25`
      ).catch(() => []),
      supabaseRest<IdentityRow[]>(
        `auth_identities?select=user_id,provider,provider_uid,verified_at&user_id=in.(${encodeURIComponent(list)})`
      ).catch(() => []),
    ]);
  }

  const shopify = shopifyAdminConfigured() ? await searchShopifyCustomers(term) : [];

  return NextResponse.json({
    ok: true,
    accounts: accounts.map((a) => ({
      ...a,
      identities: allIdentities
        .filter((i) => i.user_id === a.id)
        .map((i) => ({ provider: i.provider, uid: i.provider_uid, verified: Boolean(i.verified_at) })),
    })),
    shopify,
  });
}

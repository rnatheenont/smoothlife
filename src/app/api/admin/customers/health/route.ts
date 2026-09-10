import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getCustomerLinkState, shopifyAdminConfigured } from "@/lib/shopify-admin";

// Which accounts cannot see their own orders, without waiting for them to say so.
//
// Every fault this looks for was found by hand, one customer at a time, after
// they complained — and each time the same question followed: how many others
// are like this? Three ways an account ends up cut off from its purchases:
// nothing linked, linked to a Shopify record that has since been deleted (the
// worst kind, because it counts as linked and shows nothing forever), or
// linked to an empty record while the real one sits elsewhere. Duplicate
// accounts are listed too, since that is how a customer answers the problem
// themselves: they sign up again.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Shopify is asked once per linked account, so the sweep is bounded. */
const MAX_ACCOUNTS = 150;

type UserRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  shopify_customer_id: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  const users = await supabaseRest<UserRow[]>(
    `users?select=id,display_name,phone,shopify_customer_id,created_at&order=created_at.desc&limit=${MAX_ACCOUNTS}`
  );
  const identities = await supabaseRest<{ user_id: string; provider: string; provider_uid: string }[]>(
    `auth_identities?select=user_id,provider,provider_uid&limit=1000`
  ).catch(() => []);

  const label = (u: UserRow) => ({
    id: u.id,
    name: u.display_name,
    phone: u.phone,
    signedUp: u.created_at,
    contact:
      identities.find((i) => i.user_id === u.id && i.provider === "email")?.provider_uid ??
      identities.find((i) => i.user_id === u.id)?.provider_uid ??
      null,
  });

  const unlinked: ReturnType<typeof label>[] = [];
  const dangling: (ReturnType<typeof label> & { shopify: string })[] = [];
  const empty: (ReturnType<typeof label> & { shopify: string })[] = [];
  let healthy = 0;
  let unknown = 0;

  for (const u of users) {
    if (!u.shopify_customer_id) {
      unlinked.push(label(u));
      continue;
    }
    const state = await getCustomerLinkState(u.shopify_customer_id);
    const shopify = u.shopify_customer_id.replace("gid://shopify/Customer/", "");
    if (state === null) unknown++;
    else if (!state.exists) dangling.push({ ...label(u), shopify });
    else if (state.orders === 0) empty.push({ ...label(u), shopify });
    else healthy++;
  }

  // Same phone on two accounts is the signature of someone who signed up
  // again because the first account showed them nothing.
  const byPhone = new Map<string, UserRow[]>();
  for (const u of users) {
    const key = (u.phone || "").replace(/[^\d]/g, "").replace(/^66/, "0");
    if (key.length < 9) continue;
    byPhone.set(key, [...(byPhone.get(key) ?? []), u]);
  }
  const duplicates = [...byPhone.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([phone, list]) => ({ phone, accounts: list.map(label) }));

  return NextResponse.json({
    ok: true,
    checked: users.length,
    capped: users.length >= MAX_ACCOUNTS,
    healthy,
    unknown,
    unlinked,
    dangling,
    empty,
    duplicates,
  });
}

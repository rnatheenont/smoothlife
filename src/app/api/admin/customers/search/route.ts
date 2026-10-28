import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import {
  reachableOtherStores,
  searchShopifyCustomers,
  shopifyAdminConfigured,
  storeAdminHandle,
  storeLabel,
  type StoreKey,
} from "@/lib/shopify-admin";
import { provenMatch } from "@/lib/account-match";

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

/** The account's default delivery address, so staff editing a customer's
 *  details start from what is already on file instead of retyping it. One
 *  per account: the screen edits the default, which is the one everything
 *  else reaches for. */
type AddressRow = {
  id: string;
  user_id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

const ADDRESS_COLUMNS =
  "id,user_id,label,recipient_name,phone,address_line,subdistrict,district,province,postal_code,country,is_default";

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

  // Searching by customer id, which is the one thing support can always
  // copy out of a conversation: either the account id from this screen's own
  // URL, or the shop's customer number as the row beside it prints it.
  //
  // ilike and not eq for the shop number, because the column holds the long
  // form — gid://shopify/Customer/31241846030487 — for all but two of the
  // 438 linked accounts, so matching the whole value finds almost nobody.
  // A pasted "#31241846030487" or the whole gid both reduce to the digits.
  const accountId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)
    ? term
    : null;
  const shopDigits = term.replace(/\D/g, "");
  // Six, so a short number or part of a phone does not drag in every id
  // that happens to contain those digits.
  const shopNumber = shopDigits.length >= 6 ? shopDigits : null;

  const like = `*${term}*`;
  const userOr = [
    `display_name.ilike.${encodeURIComponent(like)}`,
    ...[...phoneForms].map((p) => `phone.eq.${pgValue(p)}`),
    ...(accountId ? [`id.eq.${pgValue(accountId)}`] : []),
    ...(shopNumber ? [`shopify_customer_id.ilike.${encodeURIComponent(`*${shopNumber}*`)}`] : []),
  ].join(",");

  const [identities, byName] = await Promise.all([
    supabaseRest<IdentityRow[]>(
      `auth_identities?select=user_id,provider,provider_uid,verified_at&provider_uid=ilike.${encodeURIComponent(like)}&limit=25`
    ).catch(() => []),
    supabaseRest<UserRow[]>(
      `users?select=id,display_name,phone,shopify_customer_id,created_at&or=(${userOr})&limit=25`
    ).catch(() => []),
  ]);

  const ids = new Set<string>([...identities.map((i) => i.user_id), ...byName.map((u) => u.id)]);
  let accounts: UserRow[] = [];
  let allIdentities: IdentityRow[] = [];
  let storeLinks: { user_id: string; store: string; shopify_customer_id: string | null }[] = [];
  let addresses: AddressRow[] = [];
  if (ids.size > 0) {
    const list = [...ids].map((id) => `"${id}"`).join(",");
    [accounts, allIdentities, storeLinks, addresses] = await Promise.all([
      supabaseRest<UserRow[]>(
        `users?select=id,display_name,phone,shopify_customer_id,created_at&id=in.(${encodeURIComponent(list)})&limit=25`
      ).catch(() => []),
      supabaseRest<IdentityRow[]>(
        `auth_identities?select=user_id,provider,provider_uid,verified_at&user_id=in.(${encodeURIComponent(list)})`
      ).catch(() => []),
      supabaseRest<{ user_id: string; store: string; shopify_customer_id: string | null }[]>(
        `store_customer_links?select=user_id,store,shopify_customer_id&shopify_customer_id=not.is.null&user_id=in.(${encodeURIComponent(list)})`
      ).catch(() => []),
      // Default first, then oldest: the same order the edit route picks the
      // row to write to, so the form shows the address the save will change.
      supabaseRest<AddressRow[]>(
        `addresses?select=${ADDRESS_COLUMNS}&user_id=in.(${encodeURIComponent(list)})&order=is_default.desc,created_at.asc`
      ).catch(() => []),
    ]);
  }

  // Every store the site can read: Smooth Life, and Smooth E / Dentiste once
  // their credentials are set. Each record says which store it is in.
  const stores: StoreKey[] = [...(shopifyAdminConfigured() ? (["smoothlife"] as const) : []), ...(await reachableOtherStores())];
  const shopify = (
    await Promise.all(
      stores.map(async (store) =>
        (await searchShopifyCustomers(term, 10, store)).map((c) => ({
          ...c,
          store,
          storeLabel: storeLabel(store),
          adminHandle: storeAdminHandle(store),
        }))
      )
    )
  ).flat();

  const withIdentities = accounts.map((a) => ({
    ...a,
    address: addresses.find((ad) => ad.user_id === a.id) ?? null,
    storeLinks: storeLinks
      .filter((l) => l.user_id === a.id)
      .map((l) => ({ store: l.store, shopifyCustomerId: l.shopify_customer_id })),
    identities: allIdentities
      .filter((i) => i.user_id === a.id)
      .map((i) => ({ provider: i.provider, uid: i.provider_uid, verified: Boolean(i.verified_at) })),
  }));

  // Which pairs the system can link on its own — the customer already proved
  // the email or phone on that Shopify record. Staff still see it and can
  // still decline; what they are spared is typing out a justification for a
  // match nobody has to take their word for.
  const proven = withIdentities.flatMap((a) =>
    shopify
      .map((c) => ({ userId: a.id, store: c.store, shopifyCustomerId: c.id, reason: provenMatch(a.identities, c) }))
      .filter((m): m is { userId: string; store: StoreKey; shopifyCustomerId: string; reason: string } => Boolean(m.reason))
  );

  // Which stores this search could actually look in, so "not found" isn't
  // read as "not a customer anywhere" while a store's keys are missing.
  const searched = (["smoothlife", "smoothe", "dentiste"] as StoreKey[]).map((store) => ({
    store,
    label: storeLabel(store),
    connected: stores.includes(store),
  }));

  return NextResponse.json({ ok: true, accounts: withIdentities, shopify, proven, searched });
}

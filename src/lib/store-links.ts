// Links from a site account to its customer record in the group's other
// Shopify stores — Smooth E (smooth-e.com) and Dentiste (dentiste-oralcare.com)
// — so orders placed there show up in the account and count toward the tier.
//
// Read only: nothing is ever created or changed in those stores. The Smooth
// Life link stays on users.shopify_customer_id and is handled by
// link-shopify-customer.ts.
//
// Only contact details the customer has proved are used to match: an email
// verified by OTP or a sign-in provider, or a phone verified by OTP. A matched
// record hands over order history and delivery addresses, so an email typed at
// registration is not enough.

import { supabaseRest, pgValue } from "@/lib/supabase-server";
import {
  configuredOtherStores,
  reachableOtherStores,
  findShopifyCustomerByEmail,
  findShopifyCustomerByPhone,
  getCustomerOrders,
  getCustomerTotals,
  type OtherStoreKey,
  type ShopifyOrderSummary,
} from "@/lib/shopify-admin";

type LinkRow = {
  store: OtherStoreKey;
  shopify_customer_id: string | null;
  matched_by: string | null;
  checked_at: string;
};

export type StoreLink = { store: OtherStoreKey; shopifyCustomerId: string };

// A store checked with no match is looked at again after this long — the
// customer may have bought there since.
const RECHECK_MS = 24 * 60 * 60 * 1000;

async function provenContacts(uid: string) {
  const rows = await supabaseRest<{ provider: string; provider_uid: string }[]>(
    `auth_identities?user_id=eq.${pgValue(uid)}&verified_at=not.is.null&provider=in.(email,phone_otp)&select=provider,provider_uid`
  ).catch(() => []);
  return {
    emails: rows.filter((r) => r.provider === "email").map((r) => r.provider_uid.toLowerCase()),
    phones: rows.filter((r) => r.provider === "phone_otp").map((r) => r.provider_uid),
  };
}

/** This account's links to the other stores that are set up. */
export async function otherStoreLinks(uid: string): Promise<StoreLink[]> {
  const stores = configuredOtherStores();
  if (stores.length === 0) return [];
  const rows = await supabaseRest<{ store: OtherStoreKey; shopify_customer_id: string | null }[]>(
    `store_customer_links?user_id=eq.${pgValue(uid)}&shopify_customer_id=not.is.null&select=store,shopify_customer_id`
  ).catch(() => [] as { store: OtherStoreKey; shopify_customer_id: string | null }[]);
  return rows
    .filter((r) => r.shopify_customer_id && stores.includes(r.store))
    .map((r) => ({ store: r.store, shopifyCustomerId: r.shopify_customer_id as string }));
}

/**
 * Looks this account up in each other store it isn't linked to yet. `force`
 * skips the once-a-day limit on stores already checked without a match — for
 * sign-in and profile changes, when the proven contacts may just have changed.
 *
 * Returns the links, and whether any is new (so the tier can be recalculated).
 * Never throws.
 */
export async function linkOtherStores(uid: string, { force = false } = {}): Promise<{ links: StoreLink[]; added: boolean }> {
  const stores = await reachableOtherStores();
  if (stores.length === 0) return { links: [], added: false };
  try {
    const rows = await supabaseRest<LinkRow[]>(
      `store_customer_links?user_id=eq.${pgValue(uid)}&select=store,shopify_customer_id,matched_by,checked_at`
    ).catch(() => [] as LinkRow[]);

    const due = stores.filter((store) => {
      const row = rows.find((r) => r.store === store);
      if (row?.shopify_customer_id) return false;
      // Staff took this link off on purpose; matching it again would undo that.
      if (row?.matched_by === "staff-unlinked") return false;
      return force || !row || Date.now() - new Date(row.checked_at).getTime() > RECHECK_MS;
    });

    let added = false;
    if (due.length > 0) {
      const contacts = await provenContacts(uid);
      await Promise.all(
        due.map(async (store) => {
          let match: { id: string } | null = null;
          let matchedBy: string | null = null;
          for (const email of contacts.emails) {
            match = await findShopifyCustomerByEmail(email, store);
            if (match) {
              matchedBy = "email";
              break;
            }
          }
          if (!match) {
            for (const phone of contacts.phones) {
              match = await findShopifyCustomerByPhone(phone, store);
              if (match) {
                matchedBy = "phone";
                break;
              }
            }
          }

          // A record already linked to another account is not adopted: one of
          // the two is wrong, and showing both people the same orders is the
          // worse way to find out. Staff merge the duplicate instead.
          if (match) {
            const taken = await supabaseRest<{ user_id: string }[]>(
              `store_customer_links?store=eq.${store}&shopify_customer_id=eq.${pgValue(match.id)}&user_id=neq.${pgValue(uid)}&select=user_id&limit=1`
            ).catch(() => []);
            if (taken.length > 0) {
              console.warn("[store-links] candidate already linked elsewhere", { uid, store, candidate: match.id });
              match = null;
            }
          }

          const now = new Date().toISOString();
          await supabaseRest("store_customer_links?on_conflict=user_id,store", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            returning: false,
            body: JSON.stringify({
              user_id: uid,
              store,
              shopify_customer_id: match?.id ?? null,
              matched_by: match ? matchedBy : null,
              linked_at: match ? now : null,
              checked_at: now,
            }),
          });
          if (match) added = true;
        })
      );
    }

    return { links: await otherStoreLinks(uid), added };
  } catch (err) {
    console.error("[store-links] linking failed", uid, err);
    return { links: await otherStoreLinks(uid).catch(() => []), added: false };
  }
}

/** Orders (and the customer record's lifetime totals) from each linked other store. */
export async function otherStoreOrders(
  links: StoreLink[],
  limit: number
): Promise<{ store: OtherStoreKey; orders: ShopifyOrderSummary[]; totals: Awaited<ReturnType<typeof getCustomerTotals>> }[]> {
  return Promise.all(
    links.map(async (l) => {
      const [orders, totals] = await Promise.all([
        getCustomerOrders(l.shopifyCustomerId, limit, l.store),
        getCustomerTotals(l.shopifyCustomerId, l.store),
      ]);
      return { store: l.store, orders: orders ?? [], totals };
    })
  );
}

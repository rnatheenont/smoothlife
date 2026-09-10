// Shared by every auth entry point (register, phone OTP, email OTP, login):
// link the account to an existing Shopify customer if one matches by
// email/phone, or create one if not, so Shopify stays the complete customer
// list regardless of where someone signed up. Also opportunistically adopts
// the Shopify customer's name (when we only have the generic "สมาชิกใหม่"
// placeholder) and surfaces their Shopify default address as a suggestion —
// never written into the structured address book automatically, since our
// address form splits ตำบล/อำเภอ out and Shopify's address has no such
// fields to split from reliably.
import { supabaseRest } from "@/lib/supabase-server";
import {
  createShopifyCustomer,
  findShopifyCustomerByEmail,
  findShopifyCustomerByPhone,
  getCustomerLinkState,
  ShopifyCustomerAddress,
} from "@/lib/shopify-admin";

export const PLACEHOLDER_NAME = "สมาชิกใหม่";

export type AddressSuggestion = {
  address_line: string;
  province: string;
  postal_code: string;
  country: string;
};

export type LinkShopifyResult = {
  shopifyCustomerId: string | null;
  displayName: string | null; // set only if we changed it
  phone: string | null; // set only if we adopted a Shopify phone
  addressSuggestion: AddressSuggestion | null;
};

function toAddressSuggestion(addr: ShopifyCustomerAddress | null): AddressSuggestion | null {
  if (!addr) return null;
  const line = [addr.address1, addr.address2].filter(Boolean).join(" ").trim();
  if (!line) return null;
  return {
    address_line: line,
    province: addr.province || "",
    postal_code: addr.zip || "",
    country: addr.country === "Thailand" ? "TH" : addr.country || "TH",
  };
}

/**
 * A phone number this account has proved it holds, or null.
 *
 * The OTP sign-in path writes an auth_identities row for the number it just
 * sent a code to, so that row — and not users.phone, which anyone can type —
 * is what makes a phone match safe to act on.
 */
async function verifiedPhone(uid: string): Promise<string | null> {
  const rows = await supabaseRest<{ provider_uid: string; verified_at: string | null }[]>(
    // "phone_otp" — the provider name the OTP sign-in actually writes. Asking
    // for "phone" matched nothing and made this fallback a no-op that looked
    // like it worked.
    `auth_identities?user_id=eq.${uid}&provider=eq.phone_otp&select=provider_uid,verified_at&limit=1`
  ).catch(() => []);
  const row = rows[0];
  return row?.verified_at && row.provider_uid ? row.provider_uid : null;
}

export async function linkOrCreateShopifyCustomer(
  uid: string,
  opts: {
    email?: string | null;
    phone?: string | null;
    currentDisplayName?: string | null;
    currentPhone?: string | null;
    // false for the self-service "retry linking my orders" flow — a miss
    // there means the Shopify order used different contact info than the
    // account, and creating a fresh empty customer would just mask that
    // (silently flip linked:true with still no real orders showing)
    // instead of correctly falling back to the "contact support" message.
    createIfMissing?: boolean;
    /** Set by ensureShopifyLink: only a candidate with orders may replace. */
    replacingEmptyLink?: boolean;
  }
): Promise<LinkShopifyResult> {
  const result: LinkShopifyResult = { shopifyCustomerId: null, displayName: null, phone: null, addressSuggestion: null };

  // Email first, then the phone — and the phone even when there IS an email.
  //
  // The old rule was "email if we have one, otherwise phone", so a customer who
  // had bought before and then signed up with a NEW address stopped at the miss
  // and got a fresh, empty Shopify record: their orders stayed on the old one,
  // invisible in their account, and only support editing the database could
  // join them back up. Their phone number had been sitting on the old record
  // the whole time.
  //
  // The fallback only trusts a phone we have actually proved they hold — an
  // OTP identity, or the number they are signing in with right now. A number
  // typed into a profile is not proof of anything, and matching on one would
  // hand whoever typed it somebody else's orders and home address.
  let match = opts.email ? await findShopifyCustomerByEmail(opts.email) : null;
  if (!match) {
    const phone = opts.email ? await verifiedPhone(uid) : opts.phone;
    if (phone) match = await findShopifyCustomerByPhone(phone);
  }

  // A Shopify record already attached to a different account is not a match to
  // adopt: one of the two is wrong, and quietly showing the same orders to both
  // people is the worse way to find out which.
  if (match && opts.replacingEmptyLink) {
    const state = await getCustomerLinkState(match.id);
    if (!state?.orders) {
      // Same emptiness, different id. Nothing to gain and a link to lose.
      match = null;
    }
  }

  // Set when the right record was found but belongs to another account — the
  // customer's own duplicate, nearly always. Creating a third empty record for
  // them is the exact behaviour that produced this mess, so nothing is created
  // in that case: staff merge the two accounts and the link comes with it.
  let takenByAnotherAccount = false;
  if (match) {
    const taken = await supabaseRest<{ id: string }[]>(
      `users?shopify_customer_id=eq.${encodeURIComponent(match.id)}&id=neq.${uid}&select=id&limit=1`
    ).catch(() => []);
    if (taken.length > 0) {
      console.warn("[link-shopify-customer] candidate already linked elsewhere", { uid, candidate: match.id });
      takenByAnotherAccount = true;
      match = null;
    }
  }

  const patch: Record<string, unknown> = {};

  if (match) {
    result.shopifyCustomerId = match.id;
    patch.shopify_customer_id = match.id;

    if (!opts.currentPhone && match.phone) {
      result.phone = match.phone;
      patch.phone = match.phone;
    }

    const shopifyName = [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
    if (shopifyName && (!opts.currentDisplayName || opts.currentDisplayName === PLACEHOLDER_NAME)) {
      result.displayName = shopifyName;
      patch.display_name = shopifyName;
    }

    // Only worth suggesting if they don't already have a saved address.
    const existing = await supabaseRest<{ id: string }[]>(`addresses?user_id=eq.${uid}&select=id&limit=1`).catch(() => []);
    if ((!existing || existing.length === 0) && match.defaultAddress) {
      result.addressSuggestion = toAddressSuggestion(match.defaultAddress);
    }
  } else if (opts.createIfMissing !== false && !takenByAnotherAccount) {
    const created = await createShopifyCustomer({
      email: opts.email,
      phone: opts.phone,
      firstName: opts.currentDisplayName && opts.currentDisplayName !== PLACEHOLDER_NAME ? opts.currentDisplayName : undefined,
    });
    if (created) {
      result.shopifyCustomerId = created.id;
      patch.shopify_customer_id = created.id;
    }
  }

  if (Object.keys(patch).length > 0) {
    try {
      await supabaseRest(`users?id=eq.${uid}`, { method: "PATCH", returning: false, body: JSON.stringify(patch) });
    } catch (err) {
      console.error("[link-shopify-customer] failed to patch user", err);
    }
  }

  return result;
}

/**
 * What every sign-in should call: make sure this account points at the Shopify
 * customer that actually holds their purchases.
 *
 * The old rule — link only when nothing is linked yet — sounds thrifty and is
 * the reason a returning customer could stay stuck forever. Signing up with a
 * new email created a fresh, empty Shopify record and wrote it to the account,
 * which then counted as "already linked", so no later sign-in ever looked
 * again. Their orders sat on the old record with nobody willing to check.
 *
 * So a link to a record with no orders is treated as unfinished business and
 * re-checked, while a link to one with orders is left alone — the customer may
 * genuinely have bought under this record and a re-point would take their
 * history away. Only a candidate that has orders can replace an existing link;
 * swapping one empty record for another would be churn.
 */
export async function ensureShopifyLink(
  uid: string,
  opts: {
    email?: string | null;
    phone?: string | null;
    currentShopifyCustomerId?: string | null;
    currentDisplayName?: string | null;
    currentPhone?: string | null;
    createIfMissing?: boolean;
    /** Set by ensureShopifyLink: only a candidate with orders may replace. */
    replacingEmptyLink?: boolean;
  }
): Promise<LinkShopifyResult> {
  const current = opts.currentShopifyCustomerId || null;
  const state = current ? await getCustomerLinkState(current) : null;
  if (current) {
    // null means Shopify did not answer — leave a working link alone rather
    // than re-point on the strength of a failed request.
    if (state === null || (state.exists && state.orders > 0)) {
      return { shopifyCustomerId: current, displayName: null, phone: null, addressSuggestion: null };
    }
  }

  // A record that is gone is worse than none: it counts as linked and shows
  // nothing forever. Those accounts may have a replacement made for them; the
  // ones merely pointing at an empty record may not, since a second empty
  // record is what got them here.
  const linkIsDangling = Boolean(current) && state?.exists === false;

  return linkOrCreateShopifyCustomer(uid, {
    ...opts,
    createIfMissing: current && !linkIsDangling ? false : opts.createIfMissing,
    replacingEmptyLink: Boolean(current) && !linkIsDangling,
  });
}

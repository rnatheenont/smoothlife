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
  ShopifyCustomerAddress,
} from "@/lib/shopify-admin";

const PLACEHOLDER_NAME = "สมาชิกใหม่";

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

export async function linkOrCreateShopifyCustomer(
  uid: string,
  opts: { email?: string | null; phone?: string | null; currentDisplayName?: string | null; currentPhone?: string | null }
): Promise<LinkShopifyResult> {
  const result: LinkShopifyResult = { shopifyCustomerId: null, displayName: null, phone: null, addressSuggestion: null };

  const match = opts.email
    ? await findShopifyCustomerByEmail(opts.email)
    : opts.phone
    ? await findShopifyCustomerByPhone(opts.phone)
    : null;

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
  } else {
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

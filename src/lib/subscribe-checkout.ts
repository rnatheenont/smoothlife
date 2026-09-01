"use client";

import { cartCreate, shopifyConfigured, type CartDeliveryAddressInput } from "@/lib/shopify";
import { toE164Thai } from "@/lib/firebase-client";
import type { AddressRow } from "@/app/api/account/addresses/route";

// Mirrors the same Thai-address mapping used by /checkout — kept as its own
// copy here (rather than exported/shared) since the subscribe buy-now flow
// is a deliberately separate path from the shared cart/checkout.
function toShopifyDeliveryAddress(addr: AddressRow): CartDeliveryAddressInput | null {
  if (addr.country !== "TH") return null;
  const [firstName, ...rest] = addr.recipient_name.trim().split(/\s+/);
  return {
    address1: addr.address_line,
    address2: addr.subdistrict ? `ตำบล/แขวง${addr.subdistrict}` : undefined,
    city: addr.district,
    provinceCode: addr.province,
    zip: addr.postal_code,
    countryCode: addr.country,
    firstName: firstName || undefined,
    lastName: rest.length ? rest.join(" ") : undefined,
    phone: addr.phone ? toE164Thai(addr.phone) : undefined,
  };
}

// Sends a subscribe order straight to its own Shopify checkout session,
// bypassing our own cart/checkout pages entirely so it never mixes with a
// customer's regular-purchase cart. Used by the discount-code fallback path
// (ProductDetailInteractive / SubscriptionPicker / SubscriptionSetDetail)
// while subscriptionBillingEnabled (real 2C2P recurring billing) is off.
export async function subscribeBuyNow(
  lines: { merchandiseId: string; quantity: number }[],
  discountCode: string,
  email?: string | null,
  phone?: string | null
): Promise<string> {
  if (!shopifyConfigured) {
    throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมต่อ Shopify กรุณาติดต่อผู้ดูแลระบบ");
  }
  let deliveryAddress: CartDeliveryAddressInput | null = null;
  if (email) {
    try {
      const res = await fetch("/api/account/addresses");
      const data = await res.json();
      const addr: AddressRow | undefined = data.addresses?.[0];
      if (addr) deliveryAddress = toShopifyDeliveryAddress(addr);
    } catch {
      // Best-effort prefill only — Shopify's own checkout still collects an
      // address if this fails, so no need to block the flow on it.
    }
  }
  const cart = await cartCreate(lines, discountCode, email || null, deliveryAddress, phone ? toE164Thai(phone) : null);
  return cart.checkoutUrl;
}

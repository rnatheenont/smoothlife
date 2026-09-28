// Paying for a flash-sale reservation at Shopify's own checkout.
//
// Our own 2C2P integration refuses anything large. Its entire history is two
// successful charges, the biggest ฿1,600, while the identical ฿55,000 went
// through Shopify's 2C2P twice in the first minutes of this sale — the same
// gateway under a different merchant profile, with limits and enabled channels
// we cannot reach from here. So when a campaign's flash price *is* the shop's
// price, the customer goes to the checkout that already works.
//
// Two things make that safe rather than merely convenient:
//
//   * The reservation rides along as a cart attribute. Shopify carries cart
//     attributes through to the order's note_attributes, so orders/paid — the
//     webhook that has been crediting points here all along — can tell which
//     slot a payment belongs to. The leading underscore keeps the raw id out
//     of the customer's sight at checkout.
//   * Shopify's checkout takes longer than 2C2P's: a card at this amount means
//     an OTP, and the shopper may be typing an address for the first time. The
//     reservation's payment hold is stretched to cover it, or a payment that
//     genuinely went through would land on a slot that had already been given
//     away.
//
// Nothing here creates a Shopify order: Shopify does that itself, which is the
// whole point. (The 2C2P path has to — see createFlashSaleOrder.)
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { cartCreate, shopifyConfigured, type CartDeliveryAddressInput } from "@/lib/shopify";
import { thPhoneE164, thProvinceCode } from "@/lib/shopify-th-address";
import { confirmFlashSalePayment, LATE_PAYMENT_NOTE, UUID_RE } from "@/lib/flash-sale";

/** Cart attribute carrying the reservation through to the order. */
export const FLASH_SALE_ENTRY_ATTR = "_flash_sale_entry_id";

/** How long the reservation is held once the shopper is sent to Shopify. */
export const SHOPIFY_CHECKOUT_MINUTES = 20;

export type FlashSaleAddress = {
  firstName?: string;
  lastName?: string;
  address1: string;
  city: string;
  state?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
};

/** Whether a flash-sale payment can go to Shopify at all. */
export function shopifyFlashSaleAvailable(): boolean {
  return shopifyConfigured;
}

function deliveryAddress(addr: FlashSaleAddress): CartDeliveryAddressInput {
  return {
    address1: addr.address1,
    city: addr.city,
    provinceCode: thProvinceCode(addr.state),
    zip: addr.postalCode,
    countryCode: addr.countryCode,
    firstName: addr.firstName,
    lastName: addr.lastName,
    phone: thPhoneE164(addr.phone),
  };
}

export type FlashSaleShopifyCheckout = {
  checkoutUrl: string;
  cartId: string;
  /** What Shopify will actually charge — its price, not our catalogue's copy of it. */
  amount: number;
  currencyCode: string;
};

/** Builds the Shopify cart for one reservation and hands back its checkout. */
export async function createFlashSaleShopifyCheckout(opts: {
  entryId: string;
  variantId: string;
  email?: string | null;
  address: FlashSaleAddress;
}): Promise<FlashSaleShopifyCheckout> {
  const cart = await cartCreate(
    [{ merchandiseId: opts.variantId, quantity: 1 }],
    null,
    opts.email ?? null,
    deliveryAddress(opts.address),
    thPhoneE164(opts.address.phone) ?? null,
    [{ key: FLASH_SALE_ENTRY_ATTR, value: opts.entryId }]
  );
  const subtotal = Number(cart.cost?.subtotalAmount?.amount ?? NaN);
  if (!cart.checkoutUrl || !Number.isFinite(subtotal)) {
    throw new Error("Shopify cart came back without a checkout url or a price");
  }
  return {
    checkoutUrl: cart.checkoutUrl,
    cartId: cart.id,
    amount: subtotal,
    currencyCode: cart.cost?.subtotalAmount?.currencyCode ?? "THB",
  };
}

/**
 * Holds the reservation for as long as Shopify's checkout may take.
 *
 * fs_start_payment allows the reservation's own window plus three minutes,
 * which is right for a payment page that opens over our own page and wrong for
 * one the shopper is sent away to. Never shortens an existing hold.
 */
export async function holdReservationForShopify(entryId: string, expiresAt: string): Promise<void> {
  const until = new Date(
    Math.max(Date.parse(expiresAt) + 3 * 60_000, Date.now() + SHOPIFY_CHECKOUT_MINUTES * 60_000)
  );
  await supabaseRest(`flash_sale_queue?id=eq.${pgValue(entryId)}&status=eq.reserved`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ payment_pending_until: until.toISOString() }),
  });
}

// ---------------------------------------------------------------------------
// Settlement, from the orders/paid webhook.
// ---------------------------------------------------------------------------

/** Only the parts of Shopify's orders/paid payload this needs. */
export type ShopifyPaidOrder = {
  id: number | string;
  name?: string | null;
  order_number?: number | string | null;
  email?: string | null;
  total_price?: string | number | null;
  note_attributes?: { name?: string; value?: string }[] | null;
  line_items?: { variant_id?: number | string | null }[] | null;
};

export type ShopifySettlementResult =
  | { flashSale: false }
  | { flashSale: true; result: "already_processed" | "confirmed" | "flagged_for_refund"; entryId: string };

function entryIdFromAttributes(order: ShopifyPaidOrder): string | null {
  for (const attr of order.note_attributes ?? []) {
    if (attr?.name === FLASH_SALE_ENTRY_ATTR && typeof attr.value === "string" && UUID_RE.test(attr.value.trim())) {
      return attr.value.trim();
    }
  }
  return null;
}

/** Trailing digits of a variant id, so a numeric webhook id compares to a stored GID. */
function variantDigits(id: string | number | null | undefined): string | null {
  const digits = String(id ?? "").match(/(\d+)\s*$/);
  return digits ? digits[1] : null;
}

/**
 * The reservation this order paid for, when the cart attribute is missing.
 *
 * A cart attribute is the reliable link and this is the net under it: money has
 * already left the customer's account by the time we are here, so an order that
 * matches exactly one waiting flash-sale checkout — same email, same variant,
 * still pending — is worth settling rather than dropping on the floor.
 */
async function entryIdByMatching(order: ShopifyPaidOrder): Promise<string | null> {
  const email = order.email?.trim().toLowerCase();
  if (!email) return null;
  const orderVariants = new Set(
    (order.line_items ?? []).map((l) => variantDigits(l?.variant_id)).filter((v): v is string => Boolean(v))
  );
  if (orderVariants.size === 0) return null;

  const since = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
  const rows = await supabaseRest<
    { flash_sale_entry_id: string; line_items: { variantId?: string }[] | null }[]
  >(
    `payment_transactions?status=eq.pending&flash_sale_entry_id=not.is.null&shopify_cart_id=not.is.null` +
      `&contact_email=eq.${pgValue(email)}&created_at=gte.${pgValue(since)}` +
      `&select=flash_sale_entry_id,line_items&order=created_at.desc&limit=10`
  ).catch(() => []);

  const matches = rows.filter((row) =>
    (row.line_items ?? []).some((line) => {
      const digits = variantDigits(line?.variantId);
      return digits !== null && orderVariants.has(digits);
    })
  );
  // Two open checkouts for the same variant and the same person is exactly the
  // case where guessing is worse than leaving it to a human.
  return matches.length === 1 ? matches[0].flash_sale_entry_id : null;
}

/**
 * Marks the reservation behind a paid Shopify order as paid. Never throws for
 * an ordinary outcome, and does nothing at all for an ordinary shop order.
 */
export async function settleFlashSaleShopifyOrder(order: ShopifyPaidOrder): Promise<ShopifySettlementResult> {
  const entryId = entryIdFromAttributes(order) ?? (await entryIdByMatching(order));
  if (!entryId) return { flashSale: false };

  const [tx] = await supabaseRest<{ id: string; status: string; amount: number }[]>(
    `payment_transactions?flash_sale_entry_id=eq.${pgValue(entryId)}&shopify_cart_id=not.is.null` +
      `&select=id,status,amount&order=created_at.desc&limit=1`
  ).catch(() => []);
  const [entry] = await supabaseRest<{ status: string }[]>(
    `flash_sale_queue?id=eq.${pgValue(entryId)}&select=status&limit=1`
  ).catch(() => []);

  // A webhook retry, or the same slot settled from somewhere else. Saying
  // "flagged for refund" here would invent a refund out of a duplicate POST.
  if (entry?.status === "paid" || (tx && tx.status !== "pending")) {
    return { flashSale: true, result: "already_processed", entryId };
  }

  const reference = order.name || `#${order.order_number ?? order.id}`;
  const paidEntry = await confirmFlashSalePayment(entryId, reference);

  if (tx) {
    const total = Number(order.total_price ?? NaN);
    await supabaseRest(`payment_transactions?id=eq.${pgValue(tx.id)}&status=eq.pending`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        status: "success",
        shopify_order_id: String(order.id),
        tran_ref: reference,
        resp_code: "0000",
        resp_desc: `Shopify checkout ${reference}`,
        confirmed_at: new Date().toISOString(),
        // Shopify charged whatever Shopify charged; the amount we wrote down
        // when opening the cart is the one worth correcting.
        ...(Number.isFinite(total) ? { amount: total } : {}),
        refund_note: paidEntry ? null : LATE_PAYMENT_NOTE,
      }),
    }).catch((err) => console.error("[flash-sale/shopify] transaction update failed", err));
  }

  if (!paidEntry) {
    console.error("[flash-sale/shopify] paid order has no live reservation — flagged for refund", reference, entryId);
    return { flashSale: true, result: "flagged_for_refund", entryId };
  }
  return { flashSale: true, result: "confirmed", entryId };
}

/**
 * The campaign settings the app on Shopify calls sub-conditions, gift
 * limitation, selection method and discount type.
 *
 * Both admin routes write the same columns, so the tidying lives in one place
 * — two copies of "what counts as a valid percentage" is two answers.
 */
export type CampaignSettings = {
  trigger_type: "cart-value" | "quantity";
  excluded_product_slugs: string[];
  scope_brands: string[];
  scope_categories: string[];
  max_gifts: number | null;
  gift_choice: "auto" | "customer";
  discount_type: "free" | "percentage" | "fixed";
  discount_value: number;
  reward_type: "gift" | "order_discount";
  customer_tiers: string[];
  first_order_only: boolean;
  min_qty: number | null;
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];

export function campaignSettings(body: Record<string, unknown>): CampaignSettings {
  const discountType =
    body.discountType === "percentage" || body.discountType === "fixed" ? body.discountType : "free";
  const rawValue = Number(body.discountValue ?? 0);
  // A percentage over 100 would price the reward below nothing, and a
  // negative one would charge more than retail for a reward.
  const value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
  const maxGifts = Number(body.maxGifts);
  const minQty = Number(body.minQty);

  return {
    trigger_type: body.triggerType === "quantity" ? "quantity" : "cart-value",
    excluded_product_slugs: strings(body.excludedProductSlugs),
    scope_brands: strings(body.scopeBrands),
    scope_categories: strings(body.scopeCategories),
    max_gifts: Number.isInteger(maxGifts) && maxGifts >= 1 && maxGifts <= 10 ? maxGifts : null,
    gift_choice: body.giftChoice === "customer" ? "customer" : "auto",
    discount_type: discountType,
    discount_value: discountType === "percentage" ? Math.min(value, 100) : value,
    reward_type: body.rewardType === "order_discount" ? "order_discount" : "gift",
    customer_tiers: strings(body.customerTiers),
    first_order_only: body.firstOrderOnly === true,
    min_qty: Number.isInteger(minQty) && minQty >= 1 && minQty <= 999 ? minQty : null,
  };
}

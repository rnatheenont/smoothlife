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
  widget_style: Record<string, unknown> | null;
  tier_mode: "cumulative" | "highest";
  schedule: { starts?: string; ends?: string }[] | null;
  starts_at: string | null;
  expires_at: string | null;
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

  // Run windows. A window with neither end is not a window, and a date the
  // browser could not parse is not one either — both are dropped rather than
  // stored as a bound nobody can reason about.
  const iso = (v: unknown) => {
    if (typeof v !== "string" || !v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  const windows = (Array.isArray(body.windows) ? body.windows : [])
    .map((w) => ({ starts: iso((w as { starts?: unknown })?.starts), ends: iso((w as { ends?: unknown })?.ends) }))
    .filter((w) => w.starts || w.ends);

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
    // An object or nothing. Null is "follow the shop default", which is not
    // the same as an empty object meaning "override with nothing".
    widget_style:
      body.widgetStyle && typeof body.widgetStyle === "object" && !Array.isArray(body.widgetStyle)
        ? (body.widgetStyle as Record<string, unknown>)
        : null,
    // Which rungs pay. The app on Shopify pays only the highest reached and
    // so does this by default — a ladder where every rung also hands over
    // everything below it gives away far more than the operator read on the
    // screen, and nothing in the form used to say which it was.
    tier_mode: body.tierMode === "cumulative" ? "cumulative" : "highest",
    schedule: windows.length > 0 ? windows : null,
    // The first window is mirrored into the old pair, because reports, the
    // admin list and anything else reading those columns should not start
    // disagreeing with the campaign the moment a second window is added.
    starts_at: windows[0]?.starts ?? null,
    expires_at: windows[0]?.ends ?? null,
  };
}

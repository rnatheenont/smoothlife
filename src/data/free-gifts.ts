import type { CartLine } from "./coupons.ts";

// These rules are the whole story for orders this site creates.
//
// They used to be half of one: a Shopify Automatic Discount did the zeroing
// and this file only drew the progress text, so a promo whose discount had
// drifted showed a "free" line nothing honoured. Orders built through the
// Admin API never run automatic discounts at all, so lib/checkout-gifts.ts
// now reads these same rules and puts the gift on the order itself at ฿0.
// shopifyDiscountId is only for the other shopfront, the theme on www, and
// nothing here depends on it.
/** One thing handed over. A promo or a tier can list several.
 *
 *  The three single-gift fields it replaces are still there and still read
 *  when this list is empty, so nothing written before it existed had to
 *  change. `giftsOf` is the one place that decides between them — read it
 *  rather than reaching for either shape directly. */
export type FreeGiftItem = {
  /** The real Shopify variant, off the free-gift shelf. */
  variantId?: string;
  /** For the handful of gifts that are ordinary catalogue products. */
  productSlug?: string;
  qty: number;
  /** Filled in by /api/free-gifts from Shopify, same as the single gift. */
  title?: string;
  image?: string | null;
  stock?: number | null;
  /** Retail price off the shelf. Only needed when the reward is a percentage
   *  off or a fixed price rather than free. */
  price?: number | null;
};

export type FreeGiftItemRow = {
  variant_id?: string | null;
  product_slug?: string | null;
  qty?: number | null;
};

export type FreeGiftTier = {
  minSubtotal: number;
  giftProductSlug: string;
  /** The real Shopify gift, same shelf the single-gift promos pick from. */
  giftVariantId?: string;
  giftTitle?: string;
  giftImage?: string | null;
  giftStock?: number | null;
  giftQty: number;
  /** Several gifts at this tier. Overrides the single-gift fields above. */
  gifts?: FreeGiftItem[];
  /** What this tier's reward costs, when it is not a giveaway. Falls back to
   *  the promo's own setting. */
  discountType?: "free" | "percentage" | "fixed";
  discountValue?: number;
  shopifyDiscountId?: string; // one real Shopify discount per tier — see activate route
};

export type FreeGiftPromo = {
  slug: string;
  active: boolean;
  titleTh: string;
  titleEn: string;
  kind: "bxgy" | "spend" | "tiered";
  buyProductSlugs?: string[]; // kind: "bxgy" — products that count toward buyQty
  buyQty?: number; // kind: "bxgy" — total qty across buyProductSlugs needed
  minSubtotal?: number; // kind: "spend" — cart subtotal threshold
  giftProductSlug: string; // kind: "bxgy" | "spend" — the single gift; unused for "tiered" (see tiers[])
  giftQty: number;
  tiers?: FreeGiftTier[]; // kind: "tiered" — ascending reward ladder, each tier's discount grants the cumulative gift set
  shopifyDiscountId?: string; // GID of the real automatic discount enforcing this (bxgy/spend only) — informational only, not read by evaluation logic
  starts?: string; // ISO datetime — before this, the promo is scheduled rather than running
  expires?: string; // ISO datetime — past this, evaluateFreeGift treats the promo as not eligible regardless of threshold
  /**
   * The gift is given out by the app on Shopify's side and this row only draws
   * the progress bar and the popup. Never creates a Shopify discount — two
   * hands reaching into one cart is how a shopper ends up with the gift twice.
   */
  displayOnly?: boolean;
  /** The real Shopify variant of the gift, when it comes from the shop's free-gift shelf. */
  giftVariantId?: string;
  /** Filled in by /api/free-gifts from Shopify: what is left of the gift. */
  giftStock?: number | null;
  /**
   * The gift's own name and picture, also from Shopify. The gifts are UNLISTED
   * there and so are absent from our catalogue — without these the cart knows a
   * gift has been unlocked and has nothing to show for it.
   */
  giftTitle?: string;
  giftImage?: string | null;
  /** Several gifts at once. Overrides the single-gift fields above. */
  gifts?: FreeGiftItem[];
  /**
   * Which tiers pay out, for kind "tiered".
   *
   * "cumulative" hands over every tier the basket reached — what this has
   * always done. "highest" hands over only the top one, which is what the
   * app the shop runs on Shopify does: an order at ฿1,599 there carries the
   * ฿1,599 gifts and not the ฿699 ones.
   */
  tierMode?: "cumulative" | "highest";
  /**
   * Whether the threshold counts money or items.
   *
   * The app on Shopify offers both ("Total cart value" / "Product quantity")
   * and a campaign written the second way cannot be expressed as the first:
   * "any three items" is not a baht figure.
   */
  triggerType?: "cart-value" | "quantity";
  /** Lines that do not count toward the threshold — the app's "Exclude
   *  product" sub-condition. A gift must not pay for itself. */
  excludedProductSlugs?: string[];
  /** Only these brands count. Empty means the whole catalogue. Stands in for
   *  the app's "Include collection", which this catalogue has no equivalent
   *  of — our cart lines carry a brand and a category, not collections. */
  scopeBrands?: string[];
  scopeCategories?: string[];
  /** Hand over at most this many of the listed gifts. Undefined means all. */
  maxGifts?: number;
  /**
   * Who puts the reward in the cart.
   *
   * "auto" is what this has always done. "customer" is the app's other mode:
   * the shopper picks which of the listed rewards they want, up to maxGifts,
   * and nothing lands until they do.
   */
  giftChoice?: "auto" | "customer";
  /**
   * What the reward costs.
   *
   * "free" is the only thing this table could say until now, and it is the
   * first entry of a dropdown in the app, not the whole of it — a milestone
   * can hand over a product at a percentage off or at a fixed price.
   */
  discountType?: "free" | "percentage" | "fixed";
  discountValue?: number;
};

// Row shape as stored in the Supabase `free_gift_promos` table (snake_case) —
// used by /api/free-gifts and the /api/admin/free-gifts routes.
export type FreeGiftTierRow = {
  min_subtotal: number;
  gift_product_slug: string;
  gift_variant_id?: string | null;
  gift_qty: number;
  gifts?: FreeGiftItemRow[] | null;
  discount_type?: "free" | "percentage" | "fixed" | null;
  discount_value?: number | null;
  shopify_discount_id: string | null;
};

export type FreeGiftPromoRow = {
  id: string;
  slug: string;
  active: boolean;
  title_th: string;
  title_en: string;
  kind: "bxgy" | "spend" | "tiered";
  buy_product_slugs: string[] | null;
  buy_qty: number | null;
  min_subtotal: number | null;
  gift_product_slug: string;
  gift_qty: number;
  tiers: FreeGiftTierRow[] | null;
  shopify_discount_id: string | null;
  starts_at: string | null;
  expires_at: string | null;
  display_only: boolean | null;
  gift_variant_id: string | null;
  gifts: FreeGiftItemRow[] | null;
  tier_mode: "cumulative" | "highest" | null;
  trigger_type: "cart-value" | "quantity" | null;
  gift_choice: "auto" | "customer" | null;
  discount_type: "free" | "percentage" | "fixed" | null;
  discount_value: number | string | null;
  excluded_product_slugs: string[] | null;
  scope_brands: string[] | null;
  scope_categories: string[] | null;
  max_gifts: number | null;
};

// Shared SELECT column list — used by both the public /api/free-gifts route
// and the admin CRUD routes so they never silently drift out of sync.
export const FREE_GIFT_COLUMNS =
  "id,slug,active,title_th,title_en,kind,buy_product_slugs,buy_qty,min_subtotal,gift_product_slug,gift_qty,tiers,shopify_discount_id,starts_at,expires_at,display_only,gift_variant_id,gifts,tier_mode,trigger_type,excluded_product_slugs,scope_brands,scope_categories,max_gifts,gift_choice,discount_type,discount_value,created_at,updated_at";

const toItems = (rows: FreeGiftItemRow[] | null | undefined): FreeGiftItem[] | undefined => {
  const list = (rows ?? [])
    .filter((g) => g && (g.variant_id || g.product_slug))
    .map((g) => ({
      variantId: g.variant_id ?? undefined,
      productSlug: g.product_slug ?? undefined,
      qty: Number(g.qty) > 0 ? Number(g.qty) : 1,
    }));
  return list.length ? list : undefined;
};

/**
 * Everything this promo hands over, as one list however it was written.
 *
 * A promo written before gifts could be a list says its single gift in three
 * columns; one written after says it in `gifts`. Everywhere downstream — the
 * cart, the checkout, the progress card — wants the same answer to the same
 * question, and this is where the two shapes become one.
 */
export function giftsOf(x: {
  gifts?: FreeGiftItem[];
  giftVariantId?: string;
  giftProductSlug?: string;
  giftQty?: number;
  giftTitle?: string;
  giftImage?: string | null;
  giftStock?: number | null;
}): FreeGiftItem[] {
  if (x.gifts?.length) return x.gifts;
  if (!x.giftVariantId && !x.giftProductSlug) return [];
  // The name, the picture and what is left come along. They live beside the
  // single gift rather than on it, and leaving them behind turned every promo
  // written the old way into an unnamed, pictureless "ของแถม" in the cart the
  // moment the cart started reading gifts through this function.
  return [
    {
      variantId: x.giftVariantId,
      productSlug: x.giftProductSlug || undefined,
      qty: x.giftQty ?? 1,
      title: x.giftTitle,
      image: x.giftImage,
      stock: x.giftStock,
    },
  ];
}

export function rowToPromo(row: FreeGiftPromoRow): FreeGiftPromo {
  return {
    slug: row.slug,
    active: row.active,
    titleTh: row.title_th,
    titleEn: row.title_en,
    kind: row.kind,
    buyProductSlugs: row.buy_product_slugs ?? undefined,
    buyQty: row.buy_qty ?? undefined,
    minSubtotal: row.min_subtotal ?? undefined,
    giftProductSlug: row.gift_product_slug,
    giftQty: row.gift_qty,
    tiers: row.tiers
      ? row.tiers.map((t) => ({
          minSubtotal: t.min_subtotal,
          giftProductSlug: t.gift_product_slug,
          giftVariantId: t.gift_variant_id ?? undefined,
          giftQty: t.gift_qty,
          gifts: toItems(t.gifts),
          discountType: t.discount_type ?? undefined,
          discountValue: t.discount_value ?? undefined,
          shopifyDiscountId: t.shopify_discount_id ?? undefined,
        }))
      : undefined,
    shopifyDiscountId: row.shopify_discount_id ?? undefined,
    starts: row.starts_at ?? undefined,
    expires: row.expires_at ?? undefined,
    // Rows written before the column existed were all mirrors too — none of
    // them ever had a Shopify discount attached.
    displayOnly: row.display_only !== false,
    giftVariantId: row.gift_variant_id ?? undefined,
    gifts: toItems(row.gifts),
    tierMode: row.tier_mode === "highest" ? "highest" : "cumulative",
    triggerType: row.trigger_type === "quantity" ? "quantity" : "cart-value",
    excludedProductSlugs: row.excluded_product_slugs ?? undefined,
    scopeBrands: row.scope_brands?.length ? row.scope_brands : undefined,
    scopeCategories: row.scope_categories?.length ? row.scope_categories : undefined,
    maxGifts: row.max_gifts ?? undefined,
    giftChoice: row.gift_choice === "customer" ? "customer" : "auto",
    discountType:
      row.discount_type === "percentage" || row.discount_type === "fixed" ? row.discount_type : "free",
    discountValue: Number(row.discount_value ?? 0) || 0,
  };
}

export type FreeGiftEval = {
  promo: FreeGiftPromo;
  eligible: boolean;
  reasonTh: string;
  reasonEn: string;
  unlockedTiers?: {
    tierIndex: number;
    giftProductSlug: string;
    giftVariantId?: string;
    giftTitle?: string;
    giftImage?: string | null;
    giftQty: number;
    /** What is left of this tier's single gift, carried through so the cart
     *  can leave out a gift the shop has run out of. */
    giftStock?: number | null;
    /** The tier's own list, carried through so the cart and the checkout can
     *  read it with giftsOf. Left out, a tier that lists its gifts here hands
     *  over nothing: the fallback looks at the single-gift fields, which a
     *  tier written as a list leaves empty. */
    gifts?: FreeGiftItem[];
    /** The tier's own reward pricing, carried so the checkout charges what
     *  the cart showed. */
    discountType?: "free" | "percentage" | "fixed";
    discountValue?: number;
  }[];
};

/**
 * The lines that count toward this promo's threshold.
 *
 * Three of the app's sub-conditions live here. "Exclude product" keeps a gift
 * from paying for itself — the live Free-gift-orders campaign excludes the
 * very product it gives away, and without that a ฿1 threshold is met by the
 * gift alone. "Include collection" narrows a campaign to part of the shop;
 * our cart lines carry a brand and a category rather than collection
 * membership, so the scope is written in those terms.
 *
 * An empty scope means the whole catalogue, which is what every promo written
 * before this did.
 */
export function qualifyingLines(promo: FreeGiftPromo, lines: CartLine[]): CartLine[] {
  const excluded = new Set(promo.excludedProductSlugs ?? []);
  const brands = promo.scopeBrands ?? [];
  const categories = promo.scopeCategories ?? [];
  return lines.filter((l) => {
    if (excluded.has(l.slug)) return false;
    if (brands.length > 0 && !brands.includes(l.brand)) return false;
    if (categories.length > 0 && !categories.includes(l.category)) return false;
    return true;
  });
}

/** What the threshold is measured in: baht, or items in the basket. */
export function triggerAmount(promo: FreeGiftPromo, lines: CartLine[]): number {
  const counted = qualifyingLines(promo, lines);
  return promo.triggerType === "quantity"
    ? counted.reduce((n, l) => n + l.qty, 0)
    : counted.reduce((sum, l) => sum + l.price * l.qty, 0);
}

/** How a threshold is written out, so the progress text does not promise baht
 *  to a campaign counted in bottles. */
export function formatTrigger(promo: FreeGiftPromo, amount: number, en = false): string {
  if (promo.triggerType === "quantity") {
    return en ? `${amount} item${amount === 1 ? "" : "s"}` : `${amount} ชิ้น`;
  }
  return `฿${amount.toLocaleString()}`;
}

export function evaluateFreeGift(promo: FreeGiftPromo, lines: CartLine[]): FreeGiftEval {
  if (!promo.active) return { promo, eligible: false, reasonTh: "", reasonEn: "" };
  // A campaign can be written today and start on a date, rather than waiting
  // for somebody to remember to switch it on at nine in the morning.
  if (promo.starts && new Date(promo.starts).getTime() > Date.now()) {
    return { promo, eligible: false, reasonTh: "ยังไม่ถึงวันเริ่มโปรโมชั่น", reasonEn: "This promotion has not started yet" };
  }
  if (promo.expires && new Date(promo.expires).getTime() < Date.now()) {
    return { promo, eligible: false, reasonTh: "โปรโมชั่นนี้หมดอายุแล้ว", reasonEn: "This promotion has ended" };
  }
  // Promising a gift the shop has run out of is worse than not promising one.
  if (promo.giftStock !== undefined && promo.giftStock !== null && promo.giftStock <= 0) {
    return { promo, eligible: false, reasonTh: "ของแถมหมดแล้ว", reasonEn: "This gift is out of stock" };
  }

  if (promo.kind === "tiered") {
    const subtotal = triggerAmount(promo, lines);
    const sortedTiers = [...(promo.tiers ?? [])].sort((a, b) => a.minSubtotal - b.minSubtotal);
    const reached = sortedTiers
      .map((t, tierIndex) => ({ t, tierIndex }))
      .filter(({ t }) => subtotal >= t.minSubtotal);
    // "highest" pays the top tier reached and nothing under it, which is what
    // the app on Shopify does. The progress text below still counts them all,
    // because how far along the ladder you are is a different question from
    // what you are getting.
    const paying = promo.tierMode === "highest" ? reached.slice(-1) : reached;
    const unlockedTiers = paying
      .map(({ t, tierIndex }) => ({
        tierIndex,
        giftProductSlug: t.giftProductSlug,
        giftVariantId: t.giftVariantId,
        giftTitle: t.giftTitle,
        giftImage: t.giftImage,
        giftQty: t.giftQty,
        giftStock: t.giftStock,
        gifts: t.gifts,
        discountType: t.discountType,
        discountValue: t.discountValue,
      }));
    if (unlockedTiers.length > 0) {
      const allUnlocked = reached.length === sortedTiers.length;
      if (allUnlocked) {
        return { promo, eligible: true, reasonTh: `รับฟรีครบทุกระดับของ ${promo.titleTh}`, reasonEn: `All tiers of ${promo.titleEn} unlocked`, unlockedTiers };
      }
      const next = sortedTiers[reached.length];
      const missing = next.minSubtotal - subtotal;
      return {
        promo,
        eligible: true,
        reasonTh: `ปลดล็อกแล้ว ${reached.length}/${sortedTiers.length} ระดับ — ซื้อเพิ่มอีก ${formatTrigger(promo, missing)} รับระดับถัดไป`,
        reasonEn: `${reached.length}/${sortedTiers.length} tiers unlocked — ${formatTrigger(promo, missing, true)} more for the next tier`,
        unlockedTiers,
      };
    }
    const first = sortedTiers[0];
    const missing = (first?.minSubtotal ?? 0) - subtotal;
    return {
      promo,
      eligible: false,
      reasonTh: `ซื้อเพิ่มอีก ${formatTrigger(promo, missing)} เพื่อปลดล็อกระดับแรก`,
      reasonEn: `${formatTrigger(promo, missing, true)} more to unlock the first tier`,
    };
  }

  if (promo.kind === "spend") {
    const subtotal = triggerAmount(promo, lines);
    if (subtotal >= (promo.minSubtotal ?? Infinity)) {
      return { promo, eligible: true, reasonTh: `รับฟรี ${promo.titleTh}`, reasonEn: `You unlocked ${promo.titleEn}` };
    }
    const missing = (promo.minSubtotal ?? 0) - subtotal;
    return {
      promo,
      eligible: false,
      reasonTh: `ซื้อเพิ่มอีก ${formatTrigger(promo, missing)} เพื่อรับของแถมฟรี`,
      reasonEn: `${formatTrigger(promo, missing, true)} more to unlock a free gift`,
    };
  }

  // "Buy X get Y", and the app's "Gift with quantity purchase" when the buy
  // list is empty: then any item counts and only the number matters.
  const buyList = promo.buyProductSlugs ?? [];
  const qtyInCart = qualifyingLines(promo, lines)
    .filter((l) => buyList.length === 0 || buyList.includes(l.slug))
    .reduce((sum, l) => sum + l.qty, 0);
  if (qtyInCart >= (promo.buyQty ?? Infinity)) {
    return { promo, eligible: true, reasonTh: `รับฟรี ${promo.titleTh}`, reasonEn: `You unlocked ${promo.titleEn}` };
  }
  const missingQty = (promo.buyQty ?? 0) - qtyInCart;
  return {
    promo,
    eligible: false,
    reasonTh: `ซื้อเพิ่มอีก ${missingQty} ชิ้น เพื่อรับของแถมฟรี`,
    reasonEn: `Add ${missingQty} more to unlock a free gift`,
  };
}

export function evaluateActiveFreeGifts(promos: FreeGiftPromo[], lines: CartLine[]): FreeGiftEval[] {
  return promos.filter((p) => p.active).map((p) => evaluateFreeGift(p, lines));
}

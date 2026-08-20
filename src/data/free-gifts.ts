import { CartLine } from "./coupons";

// Real Shopify Automatic Discount is what actually zeroes the gift's price
// at checkout — this file only computes eligibility/progress text for the
// UI. If a promo here is active but its matching Shopify discount isn't (or
// drifts out of sync), the cart would show a "free" line Shopify doesn't
// actually discount — the same trap the hardcoded coupons in coupons.ts fell
// into. Keep shopifyDiscountId pointed at the real discount whenever a promo
// is added or changed.
export type FreeGiftTier = {
  minSubtotal: number;
  giftProductSlug: string;
  giftQty: number;
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
  expires?: string; // ISO datetime — past this, evaluateFreeGift treats the promo as not eligible regardless of threshold
};

// Row shape as stored in the Supabase `free_gift_promos` table (snake_case) —
// used by /api/free-gifts and the /api/admin/free-gifts routes.
export type FreeGiftTierRow = {
  min_subtotal: number;
  gift_product_slug: string;
  gift_qty: number;
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
  expires_at: string | null;
};

// Shared SELECT column list — used by both the public /api/free-gifts route
// and the admin CRUD routes so they never silently drift out of sync.
export const FREE_GIFT_COLUMNS =
  "id,slug,active,title_th,title_en,kind,buy_product_slugs,buy_qty,min_subtotal,gift_product_slug,gift_qty,tiers,shopify_discount_id,expires_at,created_at,updated_at";

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
          giftQty: t.gift_qty,
          shopifyDiscountId: t.shopify_discount_id ?? undefined,
        }))
      : undefined,
    shopifyDiscountId: row.shopify_discount_id ?? undefined,
    expires: row.expires_at ?? undefined,
  };
}

export type FreeGiftEval = {
  promo: FreeGiftPromo;
  eligible: boolean;
  reasonTh: string;
  reasonEn: string;
  unlockedTiers?: { tierIndex: number; giftProductSlug: string; giftQty: number }[];
};

export function evaluateFreeGift(promo: FreeGiftPromo, lines: CartLine[]): FreeGiftEval {
  if (!promo.active) return { promo, eligible: false, reasonTh: "", reasonEn: "" };
  if (promo.expires && new Date(promo.expires).getTime() < Date.now()) {
    return { promo, eligible: false, reasonTh: "โปรโมชั่นนี้หมดอายุแล้ว", reasonEn: "This promotion has ended" };
  }

  if (promo.kind === "tiered") {
    const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
    const sortedTiers = [...(promo.tiers ?? [])].sort((a, b) => a.minSubtotal - b.minSubtotal);
    const unlockedTiers = sortedTiers
      .map((t, tierIndex) => ({ t, tierIndex }))
      .filter(({ t }) => subtotal >= t.minSubtotal)
      .map(({ t, tierIndex }) => ({ tierIndex, giftProductSlug: t.giftProductSlug, giftQty: t.giftQty }));
    if (unlockedTiers.length > 0) {
      const allUnlocked = unlockedTiers.length === sortedTiers.length;
      if (allUnlocked) {
        return { promo, eligible: true, reasonTh: `รับฟรีครบทุกระดับของ ${promo.titleTh}`, reasonEn: `All tiers of ${promo.titleEn} unlocked`, unlockedTiers };
      }
      const next = sortedTiers[unlockedTiers.length];
      const missing = next.minSubtotal - subtotal;
      return {
        promo,
        eligible: true,
        reasonTh: `ปลดล็อกแล้ว ${unlockedTiers.length}/${sortedTiers.length} ระดับ — ซื้อเพิ่มอีก ฿${missing.toLocaleString()} รับระดับถัดไป`,
        reasonEn: `${unlockedTiers.length}/${sortedTiers.length} tiers unlocked — spend ฿${missing.toLocaleString()} more for the next tier`,
        unlockedTiers,
      };
    }
    const first = sortedTiers[0];
    const missing = (first?.minSubtotal ?? 0) - subtotal;
    return {
      promo,
      eligible: false,
      reasonTh: `ซื้อเพิ่มอีก ฿${missing.toLocaleString()} เพื่อปลดล็อกระดับแรก`,
      reasonEn: `Spend ฿${missing.toLocaleString()} more to unlock the first tier`,
    };
  }

  if (promo.kind === "spend") {
    const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
    if (subtotal >= (promo.minSubtotal ?? Infinity)) {
      return { promo, eligible: true, reasonTh: `รับฟรี ${promo.titleTh}`, reasonEn: `You unlocked ${promo.titleEn}` };
    }
    const missing = (promo.minSubtotal ?? 0) - subtotal;
    return {
      promo,
      eligible: false,
      reasonTh: `ซื้อเพิ่มอีก ฿${missing.toLocaleString()} เพื่อรับของแถมฟรี`,
      reasonEn: `Spend ฿${missing.toLocaleString()} more to unlock a free gift`,
    };
  }

  const qtyInCart = lines
    .filter((l) => (promo.buyProductSlugs ?? []).includes(l.slug))
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

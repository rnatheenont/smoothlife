import { CartLine } from "./coupons";

// Real Shopify Automatic Discount is what actually zeroes the gift's price
// at checkout — this file only computes eligibility/progress text for the
// UI. If a promo here is active but its matching Shopify discount isn't (or
// drifts out of sync), the cart would show a "free" line Shopify doesn't
// actually discount — the same trap the hardcoded coupons in coupons.ts fell
// into. Keep shopifyDiscountId pointed at the real discount whenever a promo
// is added or changed.
export type FreeGiftPromo = {
  slug: string;
  active: boolean;
  titleTh: string;
  titleEn: string;
  kind: "bxgy" | "spend";
  buyProductSlugs?: string[]; // kind: "bxgy" — products that count toward buyQty
  buyQty?: number; // kind: "bxgy" — total qty across buyProductSlugs needed
  minSubtotal?: number; // kind: "spend" — cart subtotal threshold
  giftProductSlug: string;
  giftQty: number;
  shopifyDiscountId?: string; // GID of the real automatic discount enforcing this — informational only, not read by evaluation logic
  expires?: string;
};

// Framework only — no live promo yet.
export const freeGiftPromos: FreeGiftPromo[] = [];

/*
Example shape for future reference (not real, not active):
{
  slug: "example-bxgy",
  active: false,
  titleTh: "ซื้อ 2 ชิ้น รับฟรี 1 ชิ้น",
  titleEn: "Buy 2, get 1 free",
  kind: "bxgy",
  buyProductSlugs: ["some-real-product-slug"],
  buyQty: 2,
  giftProductSlug: "some-other-real-product-slug",
  giftQty: 1,
}
*/

export type FreeGiftEval = {
  promo: FreeGiftPromo;
  eligible: boolean;
  reasonTh: string;
  reasonEn: string;
};

export function evaluateFreeGift(promo: FreeGiftPromo, lines: CartLine[]): FreeGiftEval {
  if (!promo.active) return { promo, eligible: false, reasonTh: "", reasonEn: "" };

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

export function evaluateActiveFreeGifts(lines: CartLine[]): FreeGiftEval[] {
  return freeGiftPromos.filter((p) => p.active).map((p) => evaluateFreeGift(p, lines));
}

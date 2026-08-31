"use client";

import { useEffect, useState } from "react";
import { useCart } from "./cart-context";
import { useAuth } from "./auth-context";
import { coupons, evaluateCoupon, CartLine, pointsForAmount } from "@/data/coupons";
import { readReferralCookie, ReferralCookiePayload, REFEREE_DISCOUNT_AMOUNT, REFEREE_MIN_SUBTOTAL } from "@/lib/referral-shared";
import { loyaltyTierProgress } from "@/lib/loyalty-shared";

// Free shipping on every order, no minimum — real policy decision, not a
// promo threshold. Kept as a named constant (0) rather than deleting the
// mechanism so amountToFreeShipping/freeShipping below still resolve
// correctly for any code that reads them.
export const FREE_SHIPPING_THRESHOLD = 0;
export const SHIPPING_FEE = 50;

export function useOrderTotals() {
  const { lines, subtotal, couponCode } = useCart();
  const { user } = useAuth();

  // Read once on mount, not during render, so the server-rendered pass
  // (which never sees cookies) matches the client's first paint — avoids a
  // hydration mismatch on the discount line.
  const [referral, setReferral] = useState<ReferralCookiePayload | null>(null);
  useEffect(() => {
    setReferral(readReferralCookie());
  }, []);
  const referralActive = Boolean(referral) && subtotal >= REFEREE_MIN_SUBTOTAL;

  const cartLines: CartLine[] = lines.map((l) => ({
    slug: l.slug,
    qty: l.qty,
    price: l.price,
    brand: l.brand,
    category: l.category as CartLine["category"],
  }));

  // A referral welcome discount and a manually-picked coupon aren't set up
  // to combine in Shopify (see discountCodeBasicCreate in shopify-admin.ts —
  // no combinesWith), so showing both added together here would overstate
  // what checkout actually grants. The referral discount takes priority
  // when active — same single-discount-slot model the rest of this app
  // already uses.
  const coupon = !referralActive && couponCode ? coupons.find((c) => c.code === couponCode) || null : null;
  const evaluation = coupon
    ? evaluateCoupon(coupon, cartLines, { signedIn: Boolean(user), tier: user?.tier })
    : null;
  const applied = evaluation && evaluation.eligible ? evaluation : null;

  const discount = referralActive ? Math.min(REFEREE_DISCOUNT_AMOUNT, subtotal) : applied ? applied.discount : 0;
  const netSubtotal = Math.max(0, subtotal - discount);
  const qualifiesFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0;
  const freeShipping = qualifiesFreeShipping || Boolean(applied && applied.freeShipping);
  const shipping = freeShipping ? 0 : SHIPPING_FEE;
  const total = netSubtotal + shipping;

  const points = pointsForAmount(netSubtotal);
  const currentPoints = user?.points || 0;
  const tierSpend = user?.tierSpend || 0;
  const tierOrders = user?.tierOrders || 0;
  const progressNow = loyaltyTierProgress(tierSpend, tierOrders);
  // Projects tier standing as if this order's paid amount landed today —
  // an estimate shown before checkout, not a guarantee (the real figure is
  // whatever recalculateLoyaltyTiers computes once the order is actually
  // paid; a return/refund before then would obviously not count either).
  const progressAfter = loyaltyTierProgress(tierSpend + netSubtotal, tierOrders + (lines.length > 0 ? 1 : 0));

  return {
    subtotal,
    discount,
    netSubtotal,
    shipping,
    freeShipping,
    total,
    points,
    coupon,
    applied,
    currentPoints,
    progressNow,
    progressAfter,
    amountToFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
    referralActive,
    referralDiscountCode: referralActive ? referral!.discountCode : null,
  };
}

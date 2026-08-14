"use client";

import { useCart } from "./cart-context";
import { useAuth } from "./auth-context";
import { coupons, evaluateCoupon, CartLine, pointsForAmount, tierProgress } from "@/data/coupons";

// Free shipping on every order, no minimum — real policy decision, not a
// promo threshold. Kept as a named constant (0) rather than deleting the
// mechanism so amountToFreeShipping/freeShipping below still resolve
// correctly for any code that reads them.
export const FREE_SHIPPING_THRESHOLD = 0;
export const SHIPPING_FEE = 50;

export function useOrderTotals() {
  const { lines, subtotal, couponCode } = useCart();
  const { user } = useAuth();

  const cartLines: CartLine[] = lines.map((l) => ({
    slug: l.slug,
    qty: l.qty,
    price: l.price,
    brand: l.brand,
    category: l.category as CartLine["category"],
  }));

  const coupon = couponCode ? coupons.find((c) => c.code === couponCode) || null : null;
  const evaluation = coupon
    ? evaluateCoupon(coupon, cartLines, { signedIn: Boolean(user), tier: user?.tier })
    : null;
  const applied = evaluation && evaluation.eligible ? evaluation : null;

  const discount = applied ? applied.discount : 0;
  const netSubtotal = Math.max(0, subtotal - discount);
  const qualifiesFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0;
  const freeShipping = qualifiesFreeShipping || Boolean(applied && applied.freeShipping);
  const shipping = freeShipping ? 0 : SHIPPING_FEE;
  const total = netSubtotal + shipping;

  const points = pointsForAmount(netSubtotal);
  const currentPoints = user?.points || 0;
  const progressNow = tierProgress(currentPoints);
  const progressAfter = tierProgress(currentPoints + points);

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
  };
}

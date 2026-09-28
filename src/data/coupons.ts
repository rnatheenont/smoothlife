import { Category } from "./types";

// What the cart knows about a line. Coupons themselves — the codes, the
// rules, the arithmetic — live in Shopify now (see lib/shopify-discounts),
// so nothing in this file decides what anything is worth any more.

export type CartLine = {
  slug: string;
  qty: number;
  price: number;
  brand?: string;
  category?: Category;
};

export const POINTS_PER_BAHT = 1;

export function pointsForAmount(amount: number) {
  return Math.floor(amount * POINTS_PER_BAHT);
}


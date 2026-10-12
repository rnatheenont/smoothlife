import type { CartProduct } from "@/data/cart-product";
import type { ProductVariant } from "@/data/types";

// Turning what the cart stores into what the cart shows.
//
// Out here as plain functions, not inside the provider, for one reason: this
// is where the money on screen is worked out. A line's price, the subtotal,
// what happens when a size sells out or disappears from the catalogue —
// every one of those is an assertion rather than something to find out from
// a shopper. The provider fetches and holds state; this decides.
//
// Nothing here reads the catalogue. It is handed the few products the cart
// is about, fetched from /api/products/lite.

export type CartItem = {
  slug: string;
  /** Empty while unresolved: an item added before its default variant was
   *  known, or a cart saved by a version that stored only {slug, qty}. */
  variantId: string;
  qty: number;
  subscribeMonths?: 3 | 6 | 12;
};

export type CartLine = {
  slug: string;
  variantId: string;
  qty: number;
  name: string;
  price: number;
  image: string;
  compareAtPrice?: number;
  brand: string;
  category: string;
  size: string;
  variants: ProductVariant[];
  stock?: number;
  isGift?: boolean;
  giftPromoSlug?: string;
  subscribeMonths?: 3 | 6 | 12;
};

export type ProductsBySlug = Record<string, CartProduct>;

/** Two lines are the same line when they are the same variant bought the
 *  same way — a subscription line never merges into a one-off line. */
export function sameLine(i: CartItem, variantId: string, subscribeMonths?: 3 | 6 | 12): boolean {
  return i.variantId === variantId && i.subscribeMonths === subscribeMonths;
}

/**
 * The stock of one variant, or undefined when the shop does not publish it.
 *
 * undefined means "no limit known", never zero: a cart that treats a missing
 * number as none-left empties itself the moment the shop stops publishing
 * counts.
 */
export function stockOf(product: CartProduct | undefined, variantId: string): number | undefined {
  const v = product?.variants.find((variant) => variant.variantId === variantId);
  return typeof v?.quantity === "number" ? v.quantity : undefined;
}

/**
 * Caps a quantity at what the shop has, when it says.
 */
export function clampQty(qty: number, stock: number | undefined): number {
  if (typeof stock !== "number") return qty;
  return Math.min(qty, stock);
}

/**
 * Items brought up to date once the real product data arrives.
 *
 * Two repairs, both of which used to happen at the moment of adding because
 * the catalogue was right there:
 *   • an item with no variantId gets the product's default one;
 *   • a quantity above the stock count comes down to it.
 *
 * Items whose product has not arrived yet are left exactly as they are —
 * this runs on every fetch, and treating "not loaded" as "not sold any more"
 * would empty a cart on a slow connection.
 */
export function reconcileItems(items: CartItem[], bySlug: ProductsBySlug): CartItem[] {
  let changed = false;
  const next = items.map((item) => {
    const product = bySlug[item.slug];
    if (!product) return item;

    const variantId = item.variantId || product.variantId;
    const qty = clampQty(item.qty, stockOf(product, variantId));
    if (variantId === item.variantId && qty === item.qty) return item;
    changed = true;
    return { ...item, variantId, qty };
  });
  return changed ? next.filter((i) => i.qty > 0) : items;
}

/**
 * The rows the cart draws.
 *
 * An item whose product has not been fetched yet is left out rather than
 * drawn with blanks — the subtotal beneath it would be wrong in the
 * customer's favour or against it, and a row with no name and no price is
 * not information. It comes back on the next fetch.
 *
 * A line whose own variant has gone (a size discontinued while it sat in the
 * cart) falls back to the product's top-level price, which is what the
 * product page would quote for it today.
 */
export function buildLines(items: CartItem[], bySlug: ProductsBySlug): CartLine[] {
  const lines: CartLine[] = [];
  for (const item of items) {
    const p = bySlug[item.slug];
    if (!p) continue;
    const v = p.variants.find((variant) => variant.variantId === item.variantId);
    lines.push({
      slug: item.slug,
      variantId: item.variantId || p.variantId,
      qty: item.qty,
      name: p.name,
      price: v ? v.price : p.price,
      image: p.image,
      compareAtPrice: v ? v.compareAtPrice : p.compareAtPrice,
      brand: p.brand,
      category: p.category,
      size: v ? v.size : p.size,
      variants: p.variants,
      stock: typeof v?.quantity === "number" ? v.quantity : undefined,
      subscribeMonths: item.subscribeMonths,
    });
  }
  return lines;
}

export function subtotalOf(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.qty, 0);
}

/** A free-gift line built from a product in our own catalogue. */
export function giftLineFrom(
  product: CartProduct | undefined,
  qty: number,
  giftPromoSlug: string
): CartLine | null {
  if (!product) return null; // misconfigured slug — fail closed, don't crash the cart
  return {
    slug: product.slug,
    variantId: product.variantId,
    qty,
    name: product.name,
    price: 0,
    image: product.image,
    compareAtPrice: undefined,
    brand: product.brand,
    category: product.category,
    size: product.size,
    variants: product.variants,
    stock: undefined,
    isGift: true,
    giftPromoSlug,
  };
}

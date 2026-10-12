import type { Category, Concern, Product, ProductVariant } from "./types";
import type { ProductCardData } from "./card";

// What the cart needs to know about a product, and nothing else.
//
// The cart used to find this by searching the whole catalogue in the
// browser — which is why the catalogue had to be in the browser at all, on
// every page, for the sake of the handful of products someone has actually
// put in their cart. It comes from /api/products/lite now, a few slugs at a
// time.
//
// The variants are here in full because the cart lets you switch size in
// place: the row has to know what the other sizes are, what they cost and
// whether they are in stock.

export type CartProduct = {
  slug: string;
  name: string;
  brand: string;
  category: Category;
  image: string;
  /** The default variant's price — what a line falls back to when its own
   *  variant has gone (a size the shop stopped selling). */
  price: number;
  compareAtPrice?: number;
  variantId: string;
  size: string;
  variants: ProductVariant[];
};

/**
 * What /api/products/lite answers with: everything the browser needs about a
 * product it did not get from the server as props.
 *
 * A superset of CartProduct, because the same handful of products is wanted
 * for different reasons — a cart row, a product card in "recently viewed",
 * the concerns behind a suggestion — and three endpoints answering about the
 * same five products is three round trips to save a few hundred bytes.
 */
export type LiteProduct = CartProduct & {
  concerns: Concern[];
  rating: number;
  reviewCount: number;
  sold?: number;
  badges?: Product["badges"];
};

export function toLiteProduct(p: Product): LiteProduct {
  return {
    ...toCartProduct(p),
    concerns: p.concerns,
    rating: p.rating,
    reviewCount: p.reviewCount,
    sold: p.sold,
    badges: p.badges,
  };
}

/** The card's view of one, worked out the same way toCardData does it. */
export function cardFromLite(p: LiteProduct): ProductCardData {
  const defaultVariant = p.variants.find((v) => v.variantId === p.variantId);
  return {
    slug: p.slug,
    variantId: p.variantId,
    name: p.name,
    brand: p.brand,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    image: p.image,
    inStock: p.variants.some((v) => v.inStock),
    rating: p.rating,
    reviewCount: p.reviewCount,
    sold: p.sold,
    badges: p.badges,
    multiplePrices: p.variants.length > 1 && p.variants.some((v) => v.price !== p.price),
    quantity: typeof defaultVariant?.quantity === "number" ? defaultVariant.quantity : null,
  };
}

export function toCartProduct(p: Product): CartProduct {
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    image: p.image,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    variantId: p.variantId,
    size: p.size || "",
    variants: p.variants,
  };
}

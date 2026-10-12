import type { Product, ProductVariant } from "./types";

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
  category: string;
  image: string;
  /** The default variant's price — what a line falls back to when its own
   *  variant has gone (a size the shop stopped selling). */
  price: number;
  compareAtPrice?: number;
  variantId: string;
  size: string;
  variants: ProductVariant[];
};

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
